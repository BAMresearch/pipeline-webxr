# Pipeline WebXR

A Next.js application for visualizing 3D models in augmented reality using Babylon.js.

## Prerequisites

- Node.js 20.x or higher ([link](https://nodejs.org/en/download))
    - recommend to install it via [nvm](https://github.com/nvm-sh/nvm)
- pnpm 10.x or higher ([link](https://pnpm.io/installation))

## Getting Started

Follow these steps to set up the project locally:

1. **Clone the repository**

```bash
git clone https://github.com/cezary17/pipeline-webxr.git
cd pipeline-webxr
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Start the development server**

```bash
pnpm dev
```

This will start the development server with HTTPS enabled. The application will be available at `https://localhost:3000`.

5. **Building for production**

```bash
pnpm build
```

## Development Notes

- For proper WebXR functionality, you'll need to run the app on HTTPS, which is enabled by default with the `--experimental-https` flag in the dev script.
- To test AR features, you'll need a compatible device (AR-capable mobile phone or VR headset).
- The application uses GitHub Actions for deployment to GitHub Pages. See the `.github/workflows/nextjs.yml` file for configuration details.
    - If you use GitHub Pages to deploy the website make sure to specify the `.env.local` variables in GitHub repository secrets.
