# EduSpace

A student management web application built to help students track attendance, calculate CGPA, manage to-do lists, and monitor internal assessment (IA) marks — all from one dashboard.

## Features
- 📅 Attendance tracking
- 🎓 CGPA calculator
- ✅ To-do list manager
- 📊 IA marks tracking with visual charts
- 🔥 Urgent tasks / priority reminders

## Tech Stack
- **Backend:** FastAPI (Python)
- **Database:** SQLite (via SQLAlchemy)
- **Frontend:** HTML, CSS, JavaScript
- **Charts:** Chart.js

## Running Locally

1. Clone the repository
```bash
   git clone https://github.com/amulyarangaraj158-stack/EDUSPACE-Student-managment-system.git
   cd EDUSPACE-Student-managment-system
```

2. Install dependencies
```bash
   pip install fastapi uvicorn
```

3. Run the server
```bash
   uvicorn main:app --reload
```

4. Open your browser and go to:After pushing the code to github what can I doCharted practical post-push workflows including PRs, CI/CD, and deploymentCharted practical post-push workflows including PRs, CI/CD, and deploymentOnce your push succeeds, here's what you can do:
Verify it worked

Go to your repo page on GitHub and refresh — you should see all your files (main.py, static/, eduspace.db, etc.) listed there instead of just the README

Useful next steps

Add a proper README — describes what EduSpace does, how to run it, tech stack used (good for your portfolio/resume)
Add a .gitignore file — so junk folders like __pycache__ don't get tracked going forward:

   __pycache__/
   *.pyc
   eduspace.db

Keep pushing updates as you keep building — anytime you make changes:

powershell   git add .
   git commit -m "describe what you changed"
   git push

Share the link — you can now share your GitHub repo URL with teammates (Ananya, Ankita, etc.) or add it to your resume/portfolio
Deploy it live (optional) — if you want people to actually use EduSpace online instead of just viewing code, platforms like Render or Railway can host FastAPI apps for free. Want me to walk you through that?

Which of these would you like to do next?2nd  step explainDeliberated on .gitignore creation and cached file removal techniquesDeliberated on .gitignore creation and cached file removal techniquesHere's how to add a .gitignore file — step by step.
1. Create the file
In VS Code, right-click on the Eduspace folder in the file explorer (left sidebar) → New File → name it exactly:
.gitignore
(the dot at the start matters — no filename before it)
2. Add these lines inside it
__pycache__/
*.pyc
eduspace.db
3. Save it (Ctrl+S)
Important — since eduspace.db and __pycache__ were already committed earlier, adding them to .gitignore now only stops future changes from being tracked. To actually remove them from Git going forward, run:
powershellgit rm -r --cached __pycache__
git rm --cached eduspace.db
(Don't worry — this only removes them from Git tracking, not from your actual folder. Your files stay on your computer.)
4. Commit and push the change
powershellgit add .
git commit -m "Add .gitignore, stop tracking db and pycache"
git push
Why this matters: eduspace.db is your local database with test data — you usually don't want that in version control since it'll conflict with teammates' data and bloat the repo. __pycache__ is just Python's auto-generated cache, never needed in Git.After thisDeliberated optimal next steps and user prioritiesDeliberated optimal next steps and user prioritiesAfter that, here's what naturally comes next:
1. Confirm it worked
Refresh your GitHub repo page — eduspace.db and __pycache__ should now disappear from the file list (they're still on your computer, just no longer tracked).
2. Add a README (recommended next)
A good README makes your project look professional — explains what EduSpace does, tech stack, and how to run it. Want me to write one for you based on what I know about your project?
3. Keep working normally
From now on, whenever you make changes to your code:
powershellgit add .
git commit -m "describe what changed"
git push
That's your regular workflow going forward — no need to repeat the .gitignore setup again.
4. Optional: Deploy it live
If you want EduSpace to be accessible via a real link (not just localhost), I can walk you through deploying it on a free platform like Render or Railway. Useful for demos, submissions, or showing teammates/faculty without needing them to run it locally.
Which one do you want to do — README, or deployment?ReadmeOrchestrated practical README content for direct implementationOrchestrated practical README content for direct implementationHere's a README for EduSpace. Copy this into a new file named README.md in your Eduspace folder (right-click folder in VS Code → New File → name it README.md), then paste this in:
markdown# EduSpace

A student management web application built to help students track attendance, calculate CGPA, manage to-do lists, and monitor internal assessment (IA) marks — all from one dashboard.

## Features
- 📅 Attendance tracking
- 🎓 CGPA calculator
- ✅ To-do list manager
- 📊 IA marks tracking with visual charts
- 🔥 Urgent tasks / priority reminders

## Tech Stack
- **Backend:** FastAPI (Python)
- **Database:** SQLite (via SQLAlchemy)
- **Frontend:** HTML, CSS, JavaScript
- **Charts:** Chart.js

## Running Locally

1. Clone the repository
```bash
   git clone https://github.com/amulyarangaraj158-stack/EDUSPACE-Student-managment-system.git
   cd EDUSPACE-Student-managment-system
```

2. Install dependencies
```bash
   pip install fastapi uvicorn
```

3. Run the server
```bash
   uvicorn main:app --reload
```

4. Open your browser and go to:
http://127.0.0.1:8000
## Author
Built by Amulya R,Ananya SR
 CSE students at Sapthagiri NPS University