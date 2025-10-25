'use client';

import { useState, useRef } from "react";
import { uploadFile } from "../lib/aws/storageUtils";

interface VoiceRecorderProps {
  onRecordingComplete?: (audioUrl: string) => void;
  folder?: string;
}

export default function VoiceRecorder({ onRecordingComplete, folder = "audio" }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Failed to access microphone. Please ensure microphone permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadRecording = async () => {
    if (!audioBlob) {
      setError("No recording available to upload");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      // Create a unique filename using timestamp
      const timestamp = new Date().getTime();
      const fileName = `recording-${timestamp}.webm`;
      const path = `${folder}/${fileName}`;
      
      // Convert Blob to File object
      const audioFile = new File([audioBlob], fileName, { type: 'audio/webm' });
      
      // Upload to S3
      const fileKey = await uploadFile(audioFile, path);
      
      // Pass the audio URL to parent component
      if (onRecordingComplete && fileKey) {
        onRecordingComplete(fileKey);
      }
      
      // Clear the current recording
      setAudioBlob(null);
    } catch (error) {
      console.error("Error uploading audio:", error);
      setError("Failed to upload recording. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex gap-2 mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded-full transition ${
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
          disabled={isUploading}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
        
        {audioBlob && !isRecording && (
          <button
            onClick={uploadRecording}
            className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload Recording"}
          </button>
        )}
      </div>
      
      {audioBlob && !isUploading && (
        <div className="w-full">
          <p className="text-sm text-gray-500 mb-2">Preview your recording:</p>
          <audio controls className="w-full">
            <source src={URL.createObjectURL(audioBlob)} type="audio/webm" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      
      {isRecording && (
        <div className="flex items-center mt-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
          <p className="text-sm text-gray-600">Recording...</p>
        </div>
      )}
    </div>
  );
}