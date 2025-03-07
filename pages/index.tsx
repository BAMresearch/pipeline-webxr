"use client"

import { useEffect, useState, memo } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Use memo to prevent unnecessary re-renders of the Scene component
const Scene = memo(dynamic(() => import("../components/Scene"), { ssr: false }));

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const [formValues, setFormValues] = useState({
    scaling: "1",
    rotationX: "0",
    rotationY: "0",
    rotationZ: "0"
  });

  const [sceneParams, setSceneParams] = useState({
    modelName: "",
    modelScaling: 1,
    modelRotation: { x: 0, y: 0, z: 0 }
  });

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (selectedModel) {
      setSceneParams(prev => ({
        ...prev,
        modelName: selectedModel
      }));
    }
  }, [selectedModel]);

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

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setFormValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleUpdateParameters = () => {
    setSceneParams({
      modelName: selectedModel,
      modelScaling: parseFloat(formValues.scaling) || 1,
      modelRotation: {
        x: parseFloat(formValues.rotationX) || 0,
        y: parseFloat(formValues.rotationY) || 0,
        z: parseFloat(formValues.rotationZ) || 0
      }
    });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">AR Visualisation</h1>

      {/* Model Selection */}
      <div className="mb-4">
        <Label htmlFor="model-select">Select Model</Label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={handleModelChange}
          className="p-2 border rounded w-full mt-1"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* Parameters Form */}
      <div className="mb-4 w-full max-w-md p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Model Display Settings</h2>

        {/* Object Scaling */}
        <div className="mb-4">
          <Label htmlFor="scaling">Object Scaling</Label>
          <Input
            id="scaling"
            type="number"
            value={formValues.scaling}
            step="0.1"
            onChange={handleInputChange}
            className="mt-1"
          />
        </div>

        {/* Object Rotation */}
        <div className="mb-4">
          <Label className="block mb-2">Object Rotation (in degrees)</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="rotationX" className="text-sm">X Axis</Label>
              <Input
                id="rotationX"
                type="number"
                value={formValues.rotationX}
                step="1"
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="rotationY" className="text-sm">Y Axis</Label>
              <Input
                id="rotationY"
                type="number"
                value={formValues.rotationY}
                step="1"
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="rotationZ" className="text-sm">Z Axis</Label>
              <Input
                id="rotationZ"
                type="number"
                value={formValues.rotationZ}
                step="1"
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Single Update Button */}
        <Button
          onClick={handleUpdateParameters}
          className="w-full"
        >
          Update Model Parameters
        </Button>
      </div>

      {/* 3D Scene */}
      <div className="w-full max-w-4xl aspect-video bg-white rounded-lg shadow overflow-hidden">
        {sceneParams.modelName && (
          <Scene
            modelName={sceneParams.modelName}
            modelScaling={sceneParams.modelScaling}
            modelRotation={sceneParams.modelRotation}
          />
        )}
      </div>
    </div>
  );
}
