import React, { useState, useRef, useEffect } from 'react';
import { Camera, Scan } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';

function App() {
  const [cameraActive, setCameraActive] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [model, setModel] = useState<cocossd.ObjectDetection | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize TensorFlow and load the COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsModelLoading(true);
        await tf.ready();
        console.log("TensorFlow backend ready:", tf.getBackend());
        
        const loadedModel = await cocossd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsModelLoading(false);
        console.log("TensorFlow model loaded successfully");
      } catch (err) {
        console.error("Error loading TensorFlow model:", err);
        setIsModelLoading(false);
      }
    };
    loadModel();

    return () => {
      if (tf.getBackend() !== null) {
        tf.disposeVariables();
      }
    };
  }, []);

  // Handle object detection
  useEffect(() => {
    let animationFrameId: number;

    const detectObjects = async () => {
      if (!model || !videoRef.current || !canvasRef.current || !detectionActive) return;

      try {
        // Get predictions
        const predictions = await model.detect(videoRef.current);
        
        // Update canvas
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          ctx.font = '16px Arial';
          ctx.fillStyle = '#00FFFF';

          // Draw bounding boxes and labels
          predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            ctx.strokeRect(x, y, width, height);
            ctx.fillText(
              `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
              x,
              y > 10 ? y - 5 : 10
            );
          });
        }

        // Update detected objects list
        const objects = predictions.map(p => p.class);
        setDetectedObjects(objects);

        if (detectionActive) {
          animationFrameId = requestAnimationFrame(detectObjects);
        }
      } catch (error) {
        console.error('Detection error:', error);
        setDetectionActive(false);
      }
    };

    if (detectionActive && cameraActive) {
      detectObjects();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [model, cameraActive, detectionActive]);

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    } else {
      stopCamera();
      setDetectionActive(false);
    }
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    setCameraActive(!cameraActive);
  };

  const toggleDetection = () => {
    if (!cameraActive) {
      setCameraActive(true);
    }
    setDetectionActive(!detectionActive);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Object Detection</h1>
          <p className="text-xl text-gray-400">Real-time object detection using TensorFlow.js</p>
        </header>

        <div className="relative max-w-2xl mx-auto mb-8 rounded-lg overflow-hidden bg-black">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full aspect-video"
                aria-label="Camera feed"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
            </>
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-gray-800">
              <p className="text-gray-400">Camera inactive</p>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-6 mb-8">
          <button
            onClick={toggleCamera}
            className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
            aria-label={cameraActive ? "Deactivate camera" : "Activate camera"}
          >
            <Camera size={32} />
          </button>
          <button
            onClick={toggleDetection}
            disabled={isModelLoading || !cameraActive}
            className={`p-4 rounded-full transition-colors ${
              detectionActive 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-purple-600 hover:bg-purple-700'
            } ${(isModelLoading || !cameraActive) && 'opacity-50 cursor-not-allowed'}`}
            aria-label={detectionActive ? "Stop detection" : "Start detection"}
          >
            <Scan size={32} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Camera {cameraActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${detectionActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Detection {detectionActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          {isModelLoading && (
            <div className="text-yellow-400">Loading TensorFlow model...</div>
          )}
          {detectedObjects.length > 0 && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
              <h2 className="font-semibold mb-2">Detected Objects:</h2>
              <ul className="list-disc list-inside">
                {Array.from(new Set(detectedObjects)).map((obj, index) => (
                  <li key={index}>{obj}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;