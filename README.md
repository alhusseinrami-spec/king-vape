# King Vape catalogue (with built-in admin)

A product catalogue for King Vape. Customers pick products and flavors, and the order opens in WhatsApp (+961 71 243 971).
The owner and admins sign in on the site itself to change products, prices, photos and availability.

Live site: https://king-vape-three.vercel.app  ·  Staff sign-in: `/admin` (or the small "Staff sign-in" link at the bottom of the page).

## How it works

- `public/index.html` is the whole shop page (English and Arabic). It is built from `src/` (see "Changing the page").
- The product list is stored in a private Vercel Blob store (`king-vape-data`) and served by `/api/catalog`.
  If the store is ever unreachable, the page falls back to the built-in list in `lib/seed.json`, so ordering keeps working.
- Admin accounts, photos and the product list all live in that store. Nothing about customers is stored.
- Customers never see admin controls. Every change is checked again on the server.

## First-time setup (once)

1. Open `/admin`. While no admin exists, the page shows "Set up the owner account".
2. Enter the **setup code** (the `SETUP_CODE` environment variable of the Vercel project), your name, a username and a password.
   Setup stops working as soon as the owner exists.
3. In the admin window, tap **Admins** to add more people. Only the owner can add, reset or remove admins (up to 25).
   The new admin's password is shown once so you can send it to them. They can change it under **My account**.

## What admins can do

- Mark a whole product available or sold out, and switch single flavors/colors off (customers see them as unavailable).
- Change name, Arabic name, price (leave empty for "Ask for price"), category, specs and notes.
- Add products, delete products, upload or replace a product photo (resized in the browser before upload).
- Changes go live for customers within a few seconds. If two people edit the same product at the same time, the second save
  keeps the first person's version of that product and tells the second person; their other changes are still saved.

## Limits to know about

- There is one owner. Admins cannot manage other admins.
- The shop's WhatsApp number, the delivery fee and the category list are not editable in the admin (see below to change them).
- Lost owner password? Another admin cannot reset it. Delete `live/admins.json` in the Blob store
  (Vercel dashboard → Storage → king-vape-data → Browser). The next visit to `/admin` shows the setup screen again;
  use the setup code to create a new owner and add the admins again. Products and photos are not affected.

## Environment variables (Vercel project settings)

| Name | Where | Purpose |
|------|-------|---------|
| `BLOB_READ_WRITE_TOKEN` | automatic, from the connected Blob store | storage access (also signs login cookies if `SESSION_SECRET` is not set) |
| `SETUP_CODE` | production and preview | one-time code to create the owner account |
| `KV_PREFIX` | preview only (`preview/`) | keeps preview deployments away from the live data |
| `SESSION_SECRET` | optional | separate secret for login cookies |

## Changing the page

```
python3 src/build.py          # rebuilds public/index.html from src/ and lib/seed.json
node --test test/api.test.mjs # server tests (use a temporary folder instead of Blob)
python3 test/e2e_ui.py        # browser tests (needs Playwright + Chromium)
```

- The WhatsApp number is in `src/tpl.html` and `lib/seed.json` (search for `96171243971`).
- The flat delivery fee is `shop.delivery` in `lib/seed.json` (currently 4, in US dollars; 0 turns it off). It is added to every order's total, the cart and the WhatsApp message. Run `python3 src/build.py` after changing it.
- Categories live in `lib/cats.js` and `src/i18n.js`; keep the two in sync.
- Push to `main` to publish. Other branches get a preview deployment with its own, separate data.
