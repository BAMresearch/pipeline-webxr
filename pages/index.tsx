"use client"

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Scene = dynamic(() => import("../components/Scene"), { ssr: false })

export default function Home() {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const scalingInputRef = useRef<HTMLInputElement>(null);
  const [scaling, setScaling] = useState<number>(1);
  const [inputScaling, setInputScaling] = useState<string>("1"); // Store input value separately

  useEffect(() => {
    fetchModels()
  }, [])

  async function fetchModels() {
    const { data, error } = await supabase.storage.from("models").list("public")

    if (error) {
      console.error("Error fetching models:", error)
    } else if (data) {
      const modelNames = data.map((file) => file.name)
      setModels(modelNames)
      if (modelNames.length > 0) {
        setSelectedModel(modelNames[0])
      }
    }
  }

  const handleSetScaling = () => {
    const value = parseFloat(scalingInputRef.current?.value ?? "1");
    console.log("Set scaling", value);
    setScaling(value);
    setInputScaling(value.toString()); // Update the input field as well
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputScaling(event.target.value ?? "1"); // Update input scaling state
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">AR Visualisation</h1>
      <div className="mb-4">
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
          className="p-2 border rounded">
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <Label>Object Scaling</Label>
        <Input
          type="number"
          value={inputScaling}
          step="any"
          id={"scaling"}
          ref={scalingInputRef}
          onChange={handleInputChange}
        />
        <Button onClick={handleSetScaling}>Set Scaling</Button>
      </div>
      <div className="w-full max-w-4xl aspect-video">{selectedModel &&
        <Scene modelName={selectedModel} modelScaling={scaling} />}
      </div>
    </div>
  )
}

