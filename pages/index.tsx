'use client';

import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
    Box,
    CheckCircle2,
    Layers,
    RotateCw,
    Settings,
    ZoomIn,
} from 'lucide-react';
import SupabaseUtils from '@/lib/supabaseUtils';

// Use memo to prevent unnecessary re-renders of the Scene component
const Scene = memo(
    dynamic(() => import('../components/Scene'), { ssr: false })
);

export default function Home() {
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const [formValues, setFormValues] = useState({
        scaling: '1',
        rotationX: '0',
        rotationY: '0',
        rotationZ: '0',
    });

    const [sceneParams, setSceneParams] = useState({
        modelName: '',
        modelScaling: 1,
        modelRotation: { x: 0, y: 0, z: 0 },
    });

    useEffect(() => {
        fetchModels();
    }, []);

    useEffect(() => {
        if (selectedModel) {
            setSceneParams((prev) => ({
                ...prev,
                modelName: selectedModel,
            }));
        }
    }, [selectedModel]);

    async function fetchModels() {
        setLoading(true);
        try {
            const { data, error } = await SupabaseUtils.listModels('models');

            if (error) {
                console.error('Error fetching models:', error);
            } else if (data) {
                const modelNames = data.map(
                    (file: { name: string }) => file.name as string
                );
                setModels(modelNames);
                if (modelNames.length > 0) {
                    setSelectedModel(modelNames[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching models:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = event.target;
        setFormValues((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    const handleSliderChange = (value: number[], id: string) => {
        if (value.length > 0) {
            setFormValues((prev) => ({
                ...prev,
                [id]: String(value[0]),
            }));
        }
    };

    const handleUpdateParameters = () => {
        setSceneParams({
            modelName: selectedModel,
            modelScaling: parseFloat(formValues.scaling) || 1,
            modelRotation: {
                x: parseFloat(formValues.rotationX) || 0,
                y: parseFloat(formValues.rotationY) || 0,
                z: parseFloat(formValues.rotationZ) || 0,
            },
        });
    };

    const handleModelSelect = (model: string) => {
        setSelectedModel(model);
    };

    // Extract CSS to a separate component to avoid hydration issues
    // Don't touch it is very delicate
    const CustomStyles = () => (
        <style
            dangerouslySetInnerHTML={{
                __html: `
                .custom-slider {
                    height: 4px;
                    background-color: #3b82f6 !important;
                    border-radius: 9999px;
                }
                .custom-slider > span {
                    height: 100%;
                    background-color: #3b82f6 !important;
                    border-radius: 9999px;
                }
                .custom-slider span span {
                    height: 16px !important;
                    width: 16px !important;
                    background-color: #3b82f6 !important;
                    border: none !important;
                    box-shadow: none !important;
                    margin-top: -6px !important;
                }
            `,
            }}
        />
    );

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 p-4 md:p-8">
            <CustomStyles />

            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
                    AR Visualization
                </h1>
                <p className="text-gray-500 mt-2">
                    Explore and configure 3D models for augmented reality
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Model Preview Section */}
                <div className="lg:col-span-2">
                    <Card className="shadow-lg border-gray-200 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                            <CardTitle className="flex items-center gap-2">
                                <Box className="h-5 w-5" />
                                Model Preview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 aspect-video bg-gray-100">
                            {sceneParams.modelName ? (
                                <Scene
                                    modelName={sceneParams.modelName}
                                    modelScaling={sceneParams.modelScaling}
                                    modelRotation={sceneParams.modelRotation}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-gray-500 text-center">
                                        <Box
                                            size={48}
                                            className="mx-auto mb-2 text-gray-400"
                                        />
                                        <p>No model selected</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Controls Section */}
                <div className="lg:col-span-1">
                    <Tabs defaultValue="models" className="w-full">
                        <TabsList className="grid grid-cols-2 mb-4 w-full">
                            <TabsTrigger
                                value="models"
                                className="flex items-center gap-1"
                            >
                                <Layers className="h-4 w-4" />
                                Models
                            </TabsTrigger>
                            <TabsTrigger
                                value="settings"
                                className="flex items-center gap-1"
                            >
                                <Settings className="h-4 w-4" />
                                Settings
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="models">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Available Models</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="text-center py-6">
                                            Loading models...
                                        </div>
                                    ) : models.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {models.map((model) => (
                                                <div
                                                    key={model}
                                                    className={`rounded-md transition-all duration-200 ${
                                                        selectedModel === model
                                                            ? 'bg-blue-50 border border-blue-200 shadow-sm'
                                                            : 'border border-gray-100 hover:border-gray-200'
                                                    }`}
                                                >
                                                    <button
                                                        onClick={() =>
                                                            handleModelSelect(
                                                                model
                                                            )
                                                        }
                                                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                                                    >
                                                        <div className="flex items-center">
                                                            <Box className="h-5 w-5 text-gray-500 mr-3" />
                                                            <span
                                                                className={
                                                                    selectedModel ===
                                                                    model
                                                                        ? 'font-medium text-blue-700'
                                                                        : 'text-gray-700'
                                                                }
                                                            >
                                                                {model}
                                                            </span>
                                                        </div>
                                                        {selectedModel ===
                                                            model && (
                                                            <CheckCircle2 className="h-5 w-5 text-blue-500" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-gray-500">
                                            No models found
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Model Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Scaling Control */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <Label
                                                htmlFor="scaling"
                                                className="flex items-center gap-1"
                                            >
                                                <ZoomIn className="h-4 w-4" />
                                                Scale
                                            </Label>
                                            <Input
                                                id="scaling"
                                                type="number"
                                                value={formValues.scaling}
                                                onChange={handleInputChange}
                                                className="w-20 h-9 text-right"
                                                step="0.1"
                                            />
                                        </div>
                                        <div className="px-1 pt-1">
                                            <Slider
                                                className="custom-slider"
                                                min={0.1}
                                                max={5}
                                                step={0.1}
                                                value={[
                                                    parseFloat(
                                                        formValues.scaling
                                                    ) || 1,
                                                ]}
                                                onValueChange={(value) =>
                                                    handleSliderChange(
                                                        value,
                                                        'scaling'
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Rotation Controls */}
                                    <div className="space-y-4">
                                        <Label className="flex items-center gap-1">
                                            <RotateCw className="h-4 w-4" />
                                            Rotation (degrees)
                                        </Label>

                                        {/* X Rotation */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium">
                                                    X Axis
                                                </span>
                                                <Input
                                                    id="rotationX"
                                                    type="number"
                                                    value={formValues.rotationX}
                                                    onChange={handleInputChange}
                                                    className="w-20 h-9 text-right"
                                                    step="1"
                                                />
                                            </div>
                                            <div className="px-1 pt-1">
                                                <Slider
                                                    className="custom-slider"
                                                    min={0}
                                                    max={360}
                                                    step={5}
                                                    value={[
                                                        parseFloat(
                                                            formValues.rotationX
                                                        ) || 0,
                                                    ]}
                                                    onValueChange={(value) =>
                                                        handleSliderChange(
                                                            value,
                                                            'rotationX'
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {/* Y Rotation */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium">
                                                    Y Axis
                                                </span>
                                                <Input
                                                    id="rotationY"
                                                    type="number"
                                                    value={formValues.rotationY}
                                                    onChange={handleInputChange}
                                                    className="w-20 h-9 text-right"
                                                    step="1"
                                                />
                                            </div>
                                            <div className="px-1 pt-1">
                                                <Slider
                                                    className="custom-slider"
                                                    min={0}
                                                    max={360}
                                                    step={5}
                                                    value={[
                                                        parseFloat(
                                                            formValues.rotationY
                                                        ) || 0,
                                                    ]}
                                                    onValueChange={(value) =>
                                                        handleSliderChange(
                                                            value,
                                                            'rotationY'
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {/* Z Rotation */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium">
                                                    Z Axis
                                                </span>
                                                <Input
                                                    id="rotationZ"
                                                    type="number"
                                                    value={formValues.rotationZ}
                                                    onChange={handleInputChange}
                                                    className="w-20 h-9 text-right"
                                                    step="1"
                                                />
                                            </div>
                                            <div className="px-1 pt-1">
                                                <Slider
                                                    className="custom-slider"
                                                    min={0}
                                                    max={360}
                                                    step={5}
                                                    value={[
                                                        parseFloat(
                                                            formValues.rotationZ
                                                        ) || 0,
                                                    ]}
                                                    onValueChange={(value) =>
                                                        handleSliderChange(
                                                            value,
                                                            'rotationZ'
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleUpdateParameters}
                                        className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white font-medium h-12"
                                    >
                                        Apply Changes
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
