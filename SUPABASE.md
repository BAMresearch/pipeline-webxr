# Supabase Setup Guide for AR Visualization Project

This guide outlines how to set up Supabase as the backend for the AR Visualization project. The application uses
Supabase for storing and retrieving 3D model files and simulation results.

I chose supabase since their free tier is above any of our storage requirements, and it is much easier to use than for
example S3 buckets. You could also add all files to the `public` folder of the app instead, but it comes with a lot of
drawbacks. You would need to download all files before the app launches, it is harder to modify available models and
you need to commit the new models to git and redeploy the website for your new models to be visible.

## Prerequisites

- A [Supabase](https://supabase.io) account
- Project is set up as described in the readme

## Step 1: Create a Supabase Project

1. Log in to your Supabase account at [https://app.supabase.io/](https://app.supabase.io/)
2. Click "New Project"
3. Enter a name for your project (e.g., "pipeline-webxr")
4. Complete sign up (database password is unused as of this moment and location can be anything close to you)
5. Click "Create new project"

## Step 2: Set Up Storage Buckets

1. In your Supabase dashboard, navigate to "Storage" in the left sidebar
2. Click "Create bucket"
3. Name your bucket "models" (this name is used in the codebase)
4. Set "Public bucket" option according to your needs (you can make it private and rely on policies for access)
5. Click "Create bucket"

## Step 3: Configure Environment Variables

The application requires the following environment variables to connect to your Supabase instance:

1. Create an empty `.env.local` file in the root of your project with the following variables:

2. Find these values in your Supabase dashboard:
    - Go to "Connect" at the top of the dashboard
    - Select "App Frameworks"
    - Select `NextJS` with `Pages Router` and `supabase-js`
    - Copy the `.env.local` content to your file

The `.env.local` file should contain the variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 4: Configure Storage Policies

The application needs to access files without authentication. To enable this, you need to set up appropriate storage
policies:

1. In your Supabase dashboard, navigate to "Storage" > "Policies"
2. For the "models" bucket, create the following policies:

```sql
((bucket_id = 'models'::text) AND ((storage.extension(name) = 'gltf'::text) OR
    (storage.extension(name) = 'glb'::text)) AND (
    lower ((storage.foldername(name))[1]) = 'public'::text) AND (auth.role() = 'anon'::text))
```

This policy enables unautheticated users (which is our use case since we do not have a sign-up or login page) to fetch
files ending in `.gltf` or `.glb` from the storage bucket.

Make sure that the name `public` in the policy corresponds to the name of the top level folder in your bucket.

If you want to have a different access setup you need to modify the policy.

NOTE: Due to a change in the folder structure recently the code references the folder `public-combined`. It is pretty
much the same folder just with a modified file storage setup for models. The policy works just the same when modifying
the `public` name to `public-combined`. When setting up supabase again on a different account I would recommend naming
it public again and changing the `TOP_LEVEL_FOLDER` constant in `lib/supabaseUtils.ts` instead.

## Step 5: Folder Structure Setup

The application expects a specific folder structure within the "models" bucket. The top-level folder `public-combined`
is referenced in the code, and each model should have its own subfolder with simulation type folders inside.

### Required Folder Structure

```
models (bucket)
└── public
    ├── model1
    │   ├── simulation_type1
    │   │   ├── file1.gltf
    │   │   ├── file2.gltf
    │   │   └── ...
    │   ├── simulation_type2
    │   │   ├── result1.gltf
    │   │   ├── result2.gltf
    │   │   └── ...
    │   └── simulation_type3
    │       └── ...
    ├── model2
    │   └── ...
    └── ...
```

Each model folder must contain at least one simulation type folder (e.g., "default"). The application will list these
simulation types and allow switching between them in the UI.

NOTE: To function correctly, the names of the files have to be sorted in ascending order. The app cycles through the
meshes to display changes in the simulation. There is no time step mapping implemented.

### Important Notes on Folder Structure:

1. The `public` (or `public-combined`) folder is referenced in `lib/supabaseUtils.ts` and must be used as the top-level folder
2. Each model should have its own folder inside `public-combined`
3. Each model folder should contain at least one simulation type folder
4. Each simulation type folder should contain one or more GLTF/GLB files that represent the simulation results or model
   variations

## Step 6: Upload Your Models

1. Navigate to "Storage" > "models" in your Supabase dashboard
2. Create the folder structure as described above
3. Upload your 3D model files to the appropriate folders

## Step 7: Test the Connection

1. Start your application with `pnpm dev`
2. The application should connect to Supabase and fetch the list of available models
3. If you encounter any issues, check the browser console for error messages

## Troubleshooting and general notes

- If models are not loading check the console logs, there are still a lot of debug traces generated by the app.
- If the policy is set up incorrectly then the api call will return an empty list for available models.
- `lib/supabaseUtils.ts` has helper functions which fetch the files based on app logic (model, simulation type, file).
- Since Supabase is a well-used backend platform, chatgpt and similar had a lot of training data for it and generally produce good suggestions. If you have questions about the platform you can start out there.
- If you want to use different file format supported by `babylon.js` you could also try it out, you would need to modify the policy to also allow users to download those files from the bucket.
