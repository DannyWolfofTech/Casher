# Welcome to your Lovable project

## Recent Updates (Latest Build)

### ✅ Fixed Issues

1. **Full Transaction Table** - Added responsive table showing all CSV transactions with pagination (50 rows/page), category badges, and export to CSV (Pro/Premium only)
2. **Welcome Email** - Fixed Resend integration to send welcome email on every sign-in to natanaeltest@gmail.com 
3. **Stripe Subscriptions** - Activated Subscribe buttons for Pro (£9.99/mo) and Premium (£14.99/mo) with test card 4242 4242 4242 4242
4. **i18n Full Coverage** - Implemented react-i18next for complete translations (English/Romanian/Spanish) across dashboard, tables, and UI

### 🧪 Testing

- **CSV Upload**: Use HSBC format with columns "Transaction Description", "Amount", "Date" - Netflix/Spotify auto-categorized as "Subscription"
- **Email**: Test with natanaeltest@gmail.com - welcome email sent via Resend on signup
- **Stripe**: Use test card `4242 4242 4242 4242` for Pro/Premium checkout
- **Languages**: Switch between EN/RO/ES - all UI elements translate

### 🔧 Environment Variables Required

Add these to `.env.local` for local development:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
RESEND_API_KEY=your_resend_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key
```

## Project info

**URL**: https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
