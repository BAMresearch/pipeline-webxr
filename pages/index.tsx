"use client"

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Scene = dynamic(() => import("../components/Scene"), { ssr: false });

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const scalingInputRef = useRef<HTMLInputElement>(null);
  const [scaling, setScaling] = useState<number>(1);
  const [inputScaling, setInputScaling] = useState<string>("1");

  // Rotation state variables
  const [rotationX, setRotationX] = useState<number>(0);
  const [inputRotationX, setInputRotationX] = useState<string>("0");
  const [rotationY, setRotationY] = useState<number>(0);
  const [inputRotationY, setInputRotationY] = useState<string>("0");
  const [rotationZ, setRotationZ] = useState<number>(0);
  const [inputRotationZ, setInputRotationZ] = useState<string>("0");

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    const { data, error } = await supabase.storage.from("models").list("public");

    if (error) {
      console.error("Error fetching models:", error);
    } else if (data) {
      const modelNames = data.map((file) => file.name);
      setModels(modelNames);
      if (modelNames.length > 0) {
        setSelectedModel(modelNames[0]);
      }
    }
  }

  // Set scaling handler
  const handleSetScaling = () => {
    const value = parseFloat(scalingInputRef.current?.value ?? "1");
    setScaling(value);
    setInputScaling(value.toString());
  };

  // Set rotation handlers
  const handleSetRotation = () => {
    setRotationX(parseFloat(inputRotationX));
    setRotationY(parseFloat(inputRotationY));
    setRotationZ(parseFloat(inputRotationZ));
  };

  // Handle input changes for scaling and rotation
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    if (id === "scaling") {
      setInputScaling(value);
    } else if (id === "rotationX") {
      setInputRotationX(value);
    } else if (id === "rotationY") {
      setInputRotationY(value);
    } else if (id === "rotationZ") {
      setInputRotationZ(value);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">AR Visualisation</h1>
      <div className="mb-4">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="p-2 border rounded"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* Object Scaling */}
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

      {/* Object Rotation */}
      <div className="mb-4">
        <Label>Object Rotation (in degrees)</Label>
        <div className="flex space-x-2">
          <div>
            <Label>Rotation X</Label>
            <Input
              type="number"
              value={inputRotationX}
              step="any"
              id={"rotationX"}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label>Rotation Y</Label>
            <Input
              type="number"
              value={inputRotationY}
              step="any"
              id={"rotationY"}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label>Rotation Z</Label>
            <Input
              type="number"
              value={inputRotationZ}
              step="any"
              id={"rotationZ"}
              onChange={handleInputChange}
            />
          </div>
        </div>
        <Button onClick={handleSetRotation}>Set Rotation</Button>
      </div>
      <div className="w-full max-w-4xl aspect-video">
        {selectedModel && (
          <Scene
            modelName={selectedModel}
            modelScaling={scaling}
            modelRotation={{ x: rotationX, y: rotationY, z: rotationZ }}
          />
        )}
      </div>
    </div>
  );
}

