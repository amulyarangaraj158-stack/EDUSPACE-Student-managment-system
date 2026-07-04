
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3, hashlib, os
from datetime import datetime

app = FastAPI(title="EduSpace API")

# ── CORS (allow browser to call API) ────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve the HTML frontend ──────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return FileResponse("static/index.html")

# ════════════════════════════════════════════════════
# DATABASE SETUP (SQLite — zero config needed)
# ════════════════════════════════════════════════════
DB = "eduspace.db"

def get_db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row   # rows behave like dicts
    return con

def init_db():
    con = get_db()
    cur = con.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no  TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name     TEXT DEFAULT '',
            email    TEXT DEFAULT '',
            phone    TEXT DEFAULT '',
            branch   TEXT DEFAULT 'Computer Science',
            semester TEXT DEFAULT '4th'
        );
        CREATE TABLE IF NOT EXISTS attendance (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL,
            subject TEXT NOT NULL,
            date    TEXT NOT NULL,
            status  TEXT NOT NULL,
            session TEXT DEFAULT 'Morning'
        );
        CREATE TABLE IF NOT EXISTS grades (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL,
            sem     TEXT NOT NULL,
            subject TEXT NOT NULL,
            grade   REAL NOT NULL,
            credits INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS todos (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no  TEXT NOT NULL,
            text     TEXT NOT NULL,
            due      TEXT DEFAULT '',
            priority TEXT DEFAULT 'medium',
            subject  TEXT DEFAULT '',
            notes    TEXT DEFAULT '',
            done     INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS urgent (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL,
            topic   TEXT NOT NULL,
            urgency INTEGER NOT NULL,
            exam    TEXT DEFAULT '',
            reason  TEXT DEFAULT '',
            done    INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS activity (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL,
            text    TEXT,
            color   TEXT DEFAULT 'blue',
            time    TEXT
        );
    """)
    con.commit()
    con.close()

init_db()

# ── helpers ──────────────────────────────────────────
def hash_pwd(p): return hashlib.sha256(p.encode()).hexdigest()

def log_activity(roll, text, color="blue"):
    con = get_db()
    t = datetime.now().strftime("%I:%M %p")
    con.execute("INSERT INTO activity (roll_no,text,color,time) VALUES (?,?,?,?)",
                (roll, text, color, t))
    # keep last 12
    rows = con.execute("SELECT id FROM activity WHERE roll_no=? ORDER BY id DESC", (roll,)).fetchall()
    if len(rows) > 12:
        ids = [r["id"] for r in rows[12:]]
        con.execute(f"DELETE FROM activity WHERE id IN ({','.join('?'*len(ids))})", ids)
    con.commit()
    con.close()

# ════════════════════════════════════════════════════
# PYDANTIC MODELS (request bodies)
# ════════════════════════════════════════════════════
class LoginBody(BaseModel):
    roll_no: str
    password: str

class ProfileBody(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    branch: Optional[str] = "Computer Science"
    sem: Optional[str] = "4th"

class AttendanceBody(BaseModel):
    subject: str
    date: str
    status: str
    session: Optional[str] = "Morning"

class GradeBody(BaseModel):
    sem: str
    subject: str
    grade: float
    credits: int

class TodoBody(BaseModel):
    text: str
    due: Optional[str] = ""
    priority: Optional[str] = "medium"
    subject: Optional[str] = ""
    notes: Optional[str] = ""

class UrgentBody(BaseModel):
    topic: str
    urgency: int
    exam: Optional[str] = ""
    reason: Optional[str] = ""

# ════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════
@app.post("/api/login")
def login(body: LoginBody):
    con = get_db()
    user = con.execute("SELECT * FROM users WHERE roll_no=?", (body.roll_no,)).fetchone()
    if not user:
        # auto-register
        con.execute("INSERT INTO users (roll_no,password,name) VALUES (?,?,?)",
                    (body.roll_no, hash_pwd(body.password), body.roll_no))
        con.commit()
        user = con.execute("SELECT * FROM users WHERE roll_no=?", (body.roll_no,)).fetchone()
    else:
        if user["password"] != hash_pwd(body.password):
            con.close()
            raise HTTPException(status_code=401, detail="Wrong password")
    profile = dict(user)
    profile.pop("password")
    profile["roll"] = profile.pop("roll_no")
    con.close()
    return {"message": "ok", "profile": profile}

# ════════════════════════════════════════════════════
# PROFILE
# ════════════════════════════════════════════════════
@app.get("/api/profile/{roll}")
def get_profile(roll: str):
    con = get_db()
    u = con.execute("SELECT * FROM users WHERE roll_no=?", (roll,)).fetchone()
    con.close()
    if not u: raise HTTPException(404, "Not found")
    p = dict(u); p.pop("password"); p["roll"] = p.pop("roll_no")
    return p

@app.put("/api/profile/{roll}")
def update_profile(roll: str, body: ProfileBody):
    con = get_db()
    con.execute("""UPDATE users SET name=?,email=?,phone=?,branch=?,semester=?
                   WHERE roll_no=?""",
                (body.name, body.email, body.phone, body.branch, body.sem, roll))
    con.commit()
    con.close()
    log_activity(roll, "👤 Profile updated", "blue")
    return get_profile(roll)

# ════════════════════════════════════════════════════
# ATTENDANCE
# ════════════════════════════════════════════════════
@app.get("/api/attendance/{roll}")
def get_attendance(roll: str):
    con = get_db()
    rows = con.execute("SELECT * FROM attendance WHERE roll_no=?", (roll,)).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.post("/api/attendance/{roll}", status_code=201)
def add_attendance(roll: str, body: AttendanceBody):
    con = get_db()
    cur = con.execute("INSERT INTO attendance (roll_no,subject,date,status,session) VALUES (?,?,?,?,?)",
                      (roll, body.subject, body.date, body.status, body.session))
    con.commit()
    row = con.execute("SELECT * FROM attendance WHERE id=?", (cur.lastrowid,)).fetchone()
    con.close()
    emoji = "✅" if body.status == "present" else "❌"
    log_activity(roll, f"{emoji} Attendance logged for {body.subject}",
                 "green" if body.status == "present" else "red")
    return dict(row)

@app.delete("/api/attendance/{roll}/{att_id}")
def delete_attendance(roll: str, att_id: int):
    con = get_db()
    con.execute("DELETE FROM attendance WHERE id=? AND roll_no=?", (att_id, roll))
    con.commit(); con.close()
    return {"deleted": att_id}

# ════════════════════════════════════════════════════
# GRADES
# ════════════════════════════════════════════════════
@app.get("/api/grades/{roll}")
def get_grades(roll: str):
    con = get_db()
    rows = con.execute("SELECT * FROM grades WHERE roll_no=?", (roll,)).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.post("/api/grades/{roll}", status_code=201)
def add_grade(roll: str, body: GradeBody):
    con = get_db()
    cur = con.execute("INSERT INTO grades (roll_no,sem,subject,grade,credits) VALUES (?,?,?,?,?)",
                      (roll, body.sem, body.subject, body.grade, body.credits))
    con.commit()
    row = con.execute("SELECT * FROM grades WHERE id=?", (cur.lastrowid,)).fetchone()
    con.close()
    log_activity(roll, f"🎓 Grade added: {body.subject} = {body.grade}", "purple")
    return dict(row)

@app.delete("/api/grades/{roll}/{grade_id}")
def delete_grade(roll: str, grade_id: int):
    con = get_db()
    con.execute("DELETE FROM grades WHERE id=? AND roll_no=?", (grade_id, roll))
    con.commit(); con.close()
    return {"deleted": grade_id}

# ════════════════════════════════════════════════════
# TODOS
# ════════════════════════════════════════════════════
@app.get("/api/todos/{roll}")
def get_todos(roll: str):
    con = get_db()
    rows = con.execute("SELECT * FROM todos WHERE roll_no=?", (roll,)).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.post("/api/todos/{roll}", status_code=201)
def add_todo(roll: str, body: TodoBody):
    con = get_db()
    cur = con.execute("""INSERT INTO todos (roll_no,text,due,priority,subject,notes)
                         VALUES (?,?,?,?,?,?)""",
                      (roll, body.text, body.due, body.priority, body.subject, body.notes))
    con.commit()
    row = con.execute("SELECT * FROM todos WHERE id=?", (cur.lastrowid,)).fetchone()
    con.close()
    log_activity(roll, f"✅ Task added: {body.text}", "amber")
    return dict(row)

@app.patch("/api/todos/{roll}/{todo_id}")
def toggle_todo(roll: str, todo_id: int):
    con = get_db()
    row = con.execute("SELECT * FROM todos WHERE id=? AND roll_no=?", (todo_id, roll)).fetchone()
    if not row: raise HTTPException(404, "Not found")
    new_done = 0 if row["done"] else 1
    con.execute("UPDATE todos SET done=? WHERE id=?", (new_done, todo_id))
    con.commit()
    row = con.execute("SELECT * FROM todos WHERE id=?", (todo_id,)).fetchone()
    con.close()
    if new_done:
        log_activity(roll, f"🎉 Task completed: {row['text']}", "green")
    return dict(row)

@app.delete("/api/todos/{roll}/{todo_id}")
def delete_todo(roll: str, todo_id: int):
    con = get_db()
    con.execute("DELETE FROM todos WHERE id=? AND roll_no=?", (todo_id, roll))
    con.commit(); con.close()
    return {"deleted": todo_id}

# ════════════════════════════════════════════════════
# URGENT
# ════════════════════════════════════════════════════
@app.get("/api/urgent/{roll}")
def get_urgent(roll: str):
    con = get_db()
    rows = con.execute("SELECT * FROM urgent WHERE roll_no=?", (roll,)).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.post("/api/urgent/{roll}", status_code=201)
def add_urgent(roll: str, body: UrgentBody):
    con = get_db()
    cur = con.execute("INSERT INTO urgent (roll_no,topic,urgency,exam,reason) VALUES (?,?,?,?,?)",
                      (roll, body.topic, body.urgency, body.exam, body.reason))
    con.commit()
    row = con.execute("SELECT * FROM urgent WHERE id=?", (cur.lastrowid,)).fetchone()
    con.close()
    log_activity(roll, f"🔥 Urgent topic added: {body.topic}", "red")
    return dict(row)

@app.patch("/api/urgent/{roll}/{urgent_id}")
def toggle_urgent(roll: str, urgent_id: int):
    con = get_db()
    row = con.execute("SELECT * FROM urgent WHERE id=? AND roll_no=?", (urgent_id, roll)).fetchone()
    if not row: raise HTTPException(404, "Not found")
    new_done = 0 if row["done"] else 1
    con.execute("UPDATE urgent SET done=? WHERE id=?", (new_done, urgent_id))
    con.commit()
    row = con.execute("SELECT * FROM urgent WHERE id=?", (urgent_id,)).fetchone()
    con.close()
    if new_done:
        log_activity(roll, f"✅ Urgent topic done: {row['topic']}", "green")
    return dict(row)

@app.delete("/api/urgent/{roll}/{urgent_id}")
def delete_urgent(roll: str, urgent_id: int):
    con = get_db()
    con.execute("DELETE FROM urgent WHERE id=? AND roll_no=?", (urgent_id, roll))
    con.commit(); con.close()
    return {"deleted": urgent_id}

# ════════════════════════════════════════════════════
# ACTIVITY
# ════════════════════════════════════════════════════
@app.get("/api/activity/{roll}")
def get_activity(roll: str):
    con = get_db()
    rows = con.execute("SELECT * FROM activity WHERE roll_no=? ORDER BY id DESC LIMIT 12",
                       (roll,)).fetchall()
    con.close()
    return [dict(r) for r in rows]
#uvicorn main:app --reload

#http://localhost:8000

