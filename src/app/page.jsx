"use client";

import { useState } from "react";
import {
  Loader2,
  Upload,
  Wand2,
  Image as ImageIcon,
  Download,
} from "lucide-react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [styleImage, setStyleImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedApi, setSelectedApi] = useState("flux1");

  const generateImage = async () => {
    setLoading(true);
    try {
      let apiUrl = "";
      switch (selectedApi) {
        case "flux1":
          apiUrl =
            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev";
          break;
        case "shnell":
          apiUrl =
            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";
          break;
        case "lai":
          apiUrl =
            "https://api-inference.huggingface.co/models/Artples/LAI-ImageGeneration-vSDXL-2";
          break;
        default:
          throw new Error("Unknown API selected");
      }

      console.log("API URL:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      });

      console.log("Response Status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error Response:", errorData);
        throw new Error(
          `Failed to generate image: ${errorData.error || "Unknown error"}`
        );
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setGeneratedImage(imageUrl);
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-7xl mx-auto">
        <h1 className="text-5xl font-extrabold text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          AI Art Generator
        </h1>
        <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch">
          <div className="w-full lg:w-1/2 bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-100">
              Generate Art
            </h2>
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="prompt"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Prompt
                </label>
                <textarea
                  id="prompt"
                  placeholder="Describe the image you want to generate..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 bg-opacity-50 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200"
                  rows={4}
                />
              </div>
              <div>
                <label
                  htmlFor="styleImage"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Style Image (Optional)
                </label>
                <div className="relative">
                  <input
                    id="styleImage"
                    type="file"
                    onChange={(e) =>
                      setStyleImage(e.target.files ? e.target.files[0] : null)
                    }
                    className="hidden"
                  />
                  <label
                    htmlFor="styleImage"
                    className="flex items-center justify-center w-full px-4 py-3 bg-gray-700 bg-opacity-50 rounded-lg text-gray-300 hover:bg-opacity-70 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 cursor-pointer"
                  >
                    <ImageIcon className="w-6 h-6 mr-2" />
                    {styleImage ? styleImage.name : "Choose a style image"}
                  </label>
                </div>
              </div>
              <div className="flex space-x-2">
                {["flux1", "shnell", "lai"].map((api) => (
                  <button
                    key={api}
                    onClick={() => setSelectedApi(api)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition duration-200 ${
                      selectedApi === api
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 bg-opacity-50 text-gray-300 hover:bg-opacity-70"
                    }`}
                  >
                    {api === "flux1"
                      ? "FLUX.1"
                      : api === "shnell"
                      ? "Shnell"
                      : "LAI"}
                  </button>
                ))}
              </div>
              <button
                onClick={generateImage}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-600 hover:via-pink-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="inline-block mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="inline-block mr-2 h-5 w-5" />
                    Generate Art
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="w-full lg:w-1/2">
            <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8 h-full">
              {generatedImage ? (
                <>
                  <img
                    src={generatedImage}
                    alt="Generated Art"
                    className="w-full h-auto rounded-lg mb-6"
                  />
                  <div className="flex space-x-2">
                    <button
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-200"
                      onClick={() => window.open(generatedImage, "_blank")}
                    >
                      <Upload className="inline-block mr-2 h-5 w-5" />
                      Open Full Size
                    </button>
                    <a
                      href={generatedImage}
                      download="generated-art.png"
                      className="w-full bg-yellow-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition duration-200 text-center flex items-center justify-center"
                    >
                      <Download className="inline-block mr-2 h-5 w-5" />
                      Download Image
                    </a>
                  </div>
                </>
              ) : (
                <div className="w-full h-full min-h-[16rem] bg-gray-700 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400">
                    Your generated image will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
