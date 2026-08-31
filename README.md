# Michael Robert — Rottweiler Breeder Website

A beginner-friendly Node.js + Express + SQLite starter site with:
- Public puppy catalog
- Individual puppy pages
- Private admin login
- Add/edit/delete puppies
- Edit prices, age, gender, status and descriptions
- Upload/replace puppy photos
- Replace major public website images

## 1. Install Node.js
Install the current LTS version of Node.js from the official Node.js website.

## 2. Open this project in PowerShell
In this folder run:

```powershell
npm install
copy .env.example .env
```

Open `.env` and change `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET`.

## 3. Start the site

```powershell
npm start
```

Then open:

`http://localhost:3000`

Admin:

`http://localhost:3000/admin/login`

## 4. Important before publishing
Replace placeholder copy and photos with your real information. Do not publish health, registration, guarantee, testimonial, or other claims unless they are accurate and supported by your records.

For production hosting, use HTTPS, a strong secret/password, secure cookies, and a managed database/storage solution if your host does not provide persistent local storage.
