# Mahamaya Dant Chikitsalaya

A responsive clinic website and admin dashboard in one project folder, with an Angular client, Express API, and SQLite database.

## Install and run

Install Node.js 20 or newer. Open a terminal in this `MDC` folder (the folder containing this README and `package.json`) and run:

```powershell
npm install
npm start
```

The root install creates the one `node_modules` folder. `npm start` starts the website and API together:

- Website: <http://localhost:4200>
- API health: <http://localhost:3000/api/health>

Keep the terminal open while using the website. Press **Ctrl+C** to stop both processes. No global Angular command and no installs in subfolders are required.

To create a production frontend build, run `npm run build` from this same folder.

## For visitors

1. Open <http://localhost:4200>.
2. Use the navigation or footer links to visit the **Our team** page, jump to clinic sections, or browse the gallery. The gallery starts with an automatically fading photo slideshow, followed by a muted YouTube demo video that starts when scrolled into view (player controls include pause and sound), then a horizontally scrollable photo gallery. Browse individual speciality pages, each with its own illustration and separate English and Hindi explanations.
3. Select **Book a visit** to request an appointment. Name, age, gender, and a 10-digit Indian phone number are required; email and a description of the problem are optional. The clinic team can view the problem description alongside the booking. If that phone number already has an open request, the form shows the existing-request message and a direct, clickable clinic phone number instead of adding a duplicate.
4. Phone links use the device's dialler. Email links use the device's configured email application chooser. Maps links open directions.

## For clinic administrators

1. Select **Admin login** or open <http://localhost:4200/admin>.
2. The initial local-development credentials are:

   A successful login displays a confirmation. Incorrect credentials show an error beside the sign-in form. Change the demo password after the first login.
3. Use the dashboard sections:
   - **Appointments:** see waiting requests and recent history, update statuses, export a CSV, and search monthly JSON archives by year and month. Appointment archives are retained for the last 10 calendar years.
   - **Doctors:** add, update, and remove doctor profiles, including qualifications, introduction, expertise, and photos. Profiles appear on the public **Our team** page. Doctor data is stored in `data/doctors.json`.
   - **Offers & popups:** create an offer for one required calendar date; it is visible on the homepage for that whole date in India time. Toggle active or scheduled offers on/off and review past offers. Offer history is capped at the latest 30 entries.
   - **Admin profile:** save a personal name, phone, email, profile image, and change the password after confirming the current password.
4. Select **Sign out** when finished.

Password change uses the current password. Phone-based OTP and forgot-password recovery are intentionally not enabled yet.

Clinic settings, admin profile, and current appointments are stored in `data/clinic.sqlite`. Offers are stored in `data/offers.json`; doctor profiles are stored in `data/doctors.json`; appointment snapshots are stored as `data/appointments/YYYY/MM.json`. New uploaded images are stored under `src/assets/uploads/`, and legacy uploads remain in `uploads/`. Runtime patient records, offer history, database files, and uploaded images are excluded from Git to avoid publishing patient data or clinic uploads. These local files are not a substitute for off-site backups.

The gallery demo YouTube URL is configured in `src/assets/data.json` at `gallery.demoVideoUrl`. The app only embeds valid HTTPS YouTube/watch or youtu.be links with a valid video ID, and constructs a privacy-enhanced YouTube embed URL from the validated ID.

## Project layout

```text
MDC/
  api/                    Express API, authentication, validation, and seed data
  data/                   Generated SQLite clinic database
  data/offers.json        Local offer history (created at runtime)
  data/doctors.json       Doctor profiles (created at runtime)
  data/appointments/      Monthly JSON appointment archives (created at runtime)
  public/                 Static browser files
  src/app/components/     Reusable components, including appointment modal
  src/app/pages/          Home, gallery, team, admin dashboard, and speciality pages
  src/app/services/       Typed API client
  src/assets/             UI copy (data.json), logo, and built-in clinic photos
  src/assets/uploads/     Photos uploaded by the administrator (created at runtime)
  angular.json            Angular application configuration
  package.json            Single project manifest and start/build commands
```

Static website and admin interface copy (labels, headings, messages, placeholders, and accessibility text) is in `src/assets/data.json`. Update that file to change UI wording; clinic details and appointment data remain managed by the API/admin dashboard.

## Configuration and deployment

Local development uses the demo admin credentials automatically; no environment file is needed. For custom API credentials, copy `.env.example` to `.env` in this project folder and set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a strong `JWT_SECRET`. Do not publish the demo credentials or `.env`.

The default clinic email is `mahamayadantchikitsalaya@gmail.com`, the phone is `+91 9109378708`, and the address is Rudra Vihar Phase-1, Ashok Nagar, Sarkanda, Bilaspur, Chhattisgarh 495006. These public contact details can be edited by an administrator.

Firebase and Cloudflare hosting are not wired in yet. For now, the Express API writes local JSON archives and uploaded photos alongside the SQLite database. A static GitHub Pages or Cloudflare Pages deployment will not preserve these runtime files. Before accepting real appointments online, connect Firebase Firestore/Storage (or another managed durable store), migrate the existing SQLite and JSON data, configure backups and access rules, and then deploy the Angular frontend to Cloudflare Pages.
