                  
 
<h1 align="center" style="font-weight: bold;">AI Resume Builder App</h1>

<p align="center">
<a href="#tech">Technologies</a>
<a href="#started">Getting Started</a>
<a href="#colab">Collaborators</a>
<a href="#contribute">Contribute</a> 
</p>


<p align="center">The AI Resume Builder App helps users create professional resumes easily using AI technology. Users can add experiences, educational details, and skills, and customize their resume designs. The app uses Google AI to generate summaries and offers features for previewing, downloading, and sharing resumes.</p>


<p align="center">
<a href="https://ai-resume-builder-opal.vercel.app/">📱 AI-Resume Builder App</a>
</p>
 
<h2 id="layout">🎨 Layout</h2>
Click on <b>Signup</b> on the top right corner and then Signup using email-id or Google then go on to make your resume.
<p align="center">

![image](https://github.com/user-attachments/assets/14bbac81-28f3-4935-b470-40d51f0b1d19)
![image](https://github.com/user-attachments/assets/cad03a15-c29e-484a-8f72-1952f8b6e44f)
![image](https://github.com/user-attachments/assets/0a3dafbe-5f3e-4c64-af25-c5153c469dd8)
![image](https://github.com/user-attachments/assets/7fbf80b2-55d9-452a-99b7-5540df9a1c51)
![image](https://github.com/user-attachments/assets/5aa84f12-b814-4f29-94fb-df8aac47d9ad)


</p>
You can download it after you filled out all the details and customise colour according to your choice.
 
<h2 id="technologies">💻 Technologies</h2>

- React JS
- Vite
- Tailwind CSS
- Strapi
-Clerk
-Gemini API
 
<h2 id="started">🚀 Getting started</h2>

To set up and run the AI Resume Builder App locally, follow these steps:
 
<h3>Prerequisites</h3>

Here you list all prerequisites necessary for running your project.Make sure to hav:

- [NodeJS](https://nodejs.org/en/download/prebuilt-installer)
- [Git ](https://git-scm.com/downloads)
 
<h3>Cloning</h3>

Clone the repository to your local machine:

```bash
git clone https://github.com/Swayam-code/AI-Resume-Builder.git

```
 
<h3>Starting</h3>

Go to the project directory and install the dependencies:

```bash
cd AI-Resume-Builder
npm install
```
Start the development server:
```bash
npm run dev

```
 
<h3>Documentations that might help</h3>

[📝 How to create a Pull Request](https://www.atlassian.com/br/git/tutorials/making-a-pull-request)

[💾 Commit pattern](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)

    

Features Breakdown
------------------

1.  **Project Initialization**
    
    *   Create a React project using CLI
        
    *   Set up the app with routing and SEO configurations
        
2.  **User Authentication**
    
    *   Integrate Google authentication with Clerk
        
    *   Restrict dashboard access to authenticated users
        
3.  **Resume Building**
    
    *   Add and manage experiences, education details, and skills
        
    *   Use AI to generate summaries
        
    *   Customize and preview resumes
        
4.  **Database and API Management**
    
    *   Set up Strapi CMS and connect to a custom database
        
    *   Manage API endpoints for resume data
        
5.  **UI/UX Enhancements**
    
    *   Implement responsive and customizable design elements
        
    *   Add transitions, shadows, and interactive features
        
6.  **Deployment**
    
    *   Deploy using services like Hostinger and Renderer
        

Feel free to explore, report issues, and contribute to the AI Resume Builder App!


## Server authentication and secret migration

The browser now sends a Clerk session token to fixed same-origin `/api/resumes`, `/api/resumes/:id`, and `/api/ai` Vercel functions. The server verifies the JWT signature, issuer, exact authorized frontend origin, subject and session ID, then checks that the Clerk session is still active. Strapi and Gemini service credentials remain exclusively in the functions' server environment. Browser email filters and owner fields are ignored; every resume operation uses the verified immutable Clerk user ID. Responses keep the `{ data: ... }` shape consumed by the existing Axios-based UI. Resume preview/download is owner-only; public sharing is not supported by these private endpoints.

**Production merge gate:** Keep this change in draft until the Strapi `clerkUserId` schema is deployed, legacy ownership has been explicitly verified/migrated (or deliberately left inaccessible), replacement server credentials and exact Clerk/origin settings are configured, old exposed credentials are revoked, and a two-account production-like smoke test confirms cross-user read/update/delete denial plus owned CRUD and AI success. A green frontend build alone does not verify the separately hosted Strapi configuration.

### Required Strapi schema and permissions

This repository contains the frontend/server adapter, not the separately hosted Strapi project. Before enabling production access:

1. Add a **string** attribute named `clerkUserId` to the existing `user-resume` collection type, then rebuild/redeploy Strapi. Keep the attribute API-readable to the restricted server service token so the adapter can independently verify returned ownership. The browser-facing adapter removes this field from responses. Do not expose Strapi directly to browsers.
2. In Strapi Settings → Users & Permissions → Roles, disable **all** `user-resume` permissions for both Public and Authenticated roles unless a separate audited backend requires them. An exposed old token must be revoked; hiding it in new frontend code does not prevent direct API access.
3. Create a new **custom API token** restricted to `user-resume` find, findOne, create, update, delete. Do not give it administration or other content-type permissions. Put it only in the server's `STRAPI_API_KEY`.
4. Existing resumes without `clerkUserId` are deliberately inaccessible. As an administrator, back up the collection and build an explicit mapping of each Strapi `documentId` to a verified Clerk `user_...` ID. Review that mapping against trusted account/ownership records, populate `clerkUserId` through the administrator interface or a controlled migration, and sample-check each account after migration. **Do not auto-assign ownership from the old client-controlled `userEmail` field.** Leave ambiguous/unclaimed records inaccessible until their owner is verified. New resumes receive the owner ID from the server automatically.
5. Ensure `clerkUserId` cannot be mutated through any other public endpoint. The adapter forbids owner changes and component/relation identifier injection; direct Strapi access must remain restricted.

### Deployment and local development

Copy `.env.example` to an ignored `.env.local` and fill the placeholders with freshly rotated values. Configure the same values in Vercel for each environment. `APP_ORIGIN` must equal that deployment's exact frontend origin (scheme plus host, no trailing slash); `CLERK_ISSUER` must match the intended Clerk instance. A preview needs its own exact allowed origin and a Clerk instance/domain setup that accepts it. Configuration errors, unavailable verification, unmapped owners, invalid sessions, and provider failures fail closed.

Use `npx vercel dev` to run the Vite frontend together with the Node serverless functions. `npm run dev` alone runs only Vite and cannot serve authenticated backend routes. Production uses `npm run build` with output `dist`; `vercel.json` rewrites only SPA UI routes, preserving the API handlers.

Only `VITE_CLERK_PUBLISHABLE_KEY` is browser-safe. Delete `VITE_STRAPI_API_KEY`, `VITE_GOOGLE_AI_API_KEY`, and the obsolete `VITE_API_BASE_URL` from all hosting environments. Rotate/revoke the old **Strapi API token** in the Strapi admin and the old **Google AI API key** in Google AI Studio / Google Cloud Credentials. Restrict the replacement Google key to the Generative Language API. If a Clerk secret key was exposed elsewhere, rotate that too; its publishable key is designed to be public.

Redeploy after removing public variables and rotating credentials. Old deployments/build assets and Git history may still contain previous values; revoke those credentials first, then remove old deployments/assets through the hosting dashboard. Never copy old values into an issue, commit, screenshot or PR description. This change does not itself revoke external credentials.

### Validation and operating limits

`npm run test:security` checks missing/forged/revoked-session handling, cross-user CRUD denial, immutable ownership, unmapped historical records, ignored client email filters, bounded input, fixed provider routes, redirects, provider errors, and browser credential removal using mocked providers. It does not contact real credentials. `npm run build` checks the restored application entrypoint and route imports.

Per-instance limits allow 60 resume requests and 10 AI requests per verified user per minute. Provider calls have timeouts and redirects are disabled; JSON input is limited to 100 KB. These memory limits reset with the instance and do not coordinate across multiple instances. Add deployment-wide quotas and abuse protection for a public production service, and test one real two-account create/read/update/delete flow after schema/environment setup before enabling production traffic.
