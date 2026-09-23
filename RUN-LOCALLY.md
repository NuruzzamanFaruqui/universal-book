# Run Universal Book on your own computer

This guide assumes you have never done this before. Follow it top to bottom.
It takes about 20 minutes, and most of that is waiting for downloads.

Everything happens on your computer. **Nothing you do here can affect the real
universal-book.com website.**

---

## Step 1 — Install three free programs

Install these in order. Each one is a normal installer: download, open, click
Next until it finishes.

| # | Program | Where to get it | What it is for |
|---|---|---|---|
| 1 | **Node.js** (choose the **LTS** button) | https://nodejs.org | Runs the website code |
| 2 | **Docker Desktop** | https://www.docker.com/products/docker-desktop | Runs the database |
| 3 | **Visual Studio Code** | https://code.visualstudio.com | The editor you will work in |

After installing Docker Desktop, **open it once** and leave it open. Wait until
the bottom-left corner says **"Engine running"** with a green dot. Docker has to
be running whenever you want to use the project.

> **Windows note:** Docker Desktop may ask to install something called WSL 2 and
> restart your computer. Say yes, restart, then open Docker Desktop again.

---

## Step 2 — Get the code

Open Visual Studio Code. Then:

1. Press **Ctrl+Shift+P** (on a Mac, **Cmd+Shift+P**). A search box appears at
   the top.
2. Type `git clone` and press **Enter**.
3. Paste this and press **Enter**:

   ```
   https://github.com/NuruzzamanFaruqui/universal-book.git
   ```

4. Choose a folder to put it in — your Desktop is fine.
5. When it asks *"Would you like to open the cloned repository?"*, click
   **Open**.

You should now see the project's files in the left-hand panel.

> If VS Code says Git is not installed, get it from https://git-scm.com,
> then close and reopen VS Code and try again.

---

## Step 3 — Open the terminal

In VS Code, press **Ctrl+`** — that is the key just above **Tab**, with the
`~` symbol on it. (On a Mac, **Ctrl+`** as well.)

A black panel opens at the bottom. This is where you type commands. Every
command below goes in there, one at a time, pressing **Enter** after each.

---

## Step 4 — Set it up (once only)

Type this and press **Enter**:

```
npm run setup
```

Now wait. It prints nine steps as it goes and tells you what it is doing.
The first time it downloads a lot, so **5–10 minutes is normal.** Lines that say
`npm warn` are not errors — ignore them.

When it is finished you will see:

```
✓ Setup finished.
```

If it stops with a red **✗ Stopped**, read the *What to do* text underneath it.
It tells you exactly what to fix.

You never have to run this step again.

---

## Step 5 — Start it

```
npm run dev
```

After about 30 seconds you will see:

```
Website   http://localhost:3000
```

**Ctrl+click that link** (Cmd+click on a Mac), or open a browser and go to
http://localhost:3000 yourself.

The website is now running on your computer. 🎉

---

## Step 6 — Sign in

An account has already been made for you:

| | |
|---|---|
| **Email** | `author@local.test` |
| **Password** | `Password123!` |

It starts with 500 credits, so nothing will ask you to pay.

To see the admin panel, sign in as `faruqui.swe@diu.edu.bd` with the same
password and go to http://localhost:3000/universalbook-admin

---

## Using it day to day

**To stop everything:** click on the terminal and press **Ctrl+C**.

**To start again tomorrow:** open Docker Desktop, then in VS Code run:

```
npm run dev
```

That is all — Step 4 is never repeated.

**While it is running,** any file you change and save updates the website
straight away. Just refresh your browser.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| `Docker is not running` | Open Docker Desktop and wait for the green "Engine running" dot. Then try again. |
| `npm: command not found` | Node.js is not installed, or VS Code was open while you installed it. Close VS Code completely, open it again. |
| `This project has not been set up yet` | Run `npm run setup` first. |
| `port 3000 is already in use` | Something else is using it. Close other terminals, or restart your computer. |
| The page loads but says *AI is unavailable* | Expected. AI features need a paid Anthropic key — see **Optional extras** below. |
| Anything else | Press **Ctrl+C**, then run `npm run dev` again. If it still fails, run `npm run db:reset` and then `npm run dev`. |

**The safe reset button.** This wipes the practice data on your computer and
starts clean. It cannot touch the real website:

```
npm run db:reset
```

---

## All the commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time setup. Once only. |
| `npm run dev` | Start the website. This is the one you use. |
| `npm run db:reset` | Empty your practice database and start fresh. |
| `npm run db:studio` | Open a spreadsheet-like view of your local data. |
| `npm run db:stop` | Shut the database down to free up memory. |

---

## Optional extras

Everything above works without these. Add them only if you need the feature.

Open the file `apps/api/.env` in VS Code and fill in a value, then stop
(**Ctrl+C**) and start (`npm run dev`) again.

| Setting | Unlocks | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI writing, chat, review | Those buttons show a polite "unavailable" message |
| `STRIPE_SECRET_KEY` | Buying credits with a card | Use the demo account's 500 credits |
| `RESEND_API_KEY` | Sending real emails | Password-reset links are printed in the terminal instead, which is easier anyway |

---

## What is actually running

Three things, so the terminal output makes sense:

- **web** — the website you look at, on port 3000
- **api** — the part that stores and fetches data, on port 8080
- **db** — a PostgreSQL database inside Docker, on port 5433

`npm run dev` starts all three and labels each line of output with `web` or
`api` so you can tell them apart.
