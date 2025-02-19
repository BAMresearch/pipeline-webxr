import type { NextApiRequest, NextApiResponse } from "next"
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient({ req, res })
  const { name } = req.query

  if (typeof name !== "string") {
    return res.status(400).json({ error: "Invalid model name" })
  }

  try {
    const { data, error } = await supabase.storage.from("models").download(name)

    if (error) {
      throw error
    }

    if (!data) {
      return res.status(404).json({ error: "Model not found" })
    }

    const arrayBuffer = await data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    res.setHeader("Content-Type", "application/octet-stream")
    res.setHeader("Content-Disposition", `attachment; filename=${name}`)
    res.send(buffer)
  } catch (error) {
    console.error("Error fetching model:", error)
    res.status(500).json({ error: "Error fetching model" })
  }
}

