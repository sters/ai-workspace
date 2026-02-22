"use client";

import { useEffect, useRef, useState } from "react";

interface SubagentOutputState {
  content: string;
  loading: boolean;
  error: boolean;
}

/**
 * Stream sub-agent output file content via SSE.
 * Connects to /api/subagent-output (SSE) when enabled and accumulates chunks.
 */
export function useSubagentOutput(
  outputFile: string | undefined,
  _isRunning: boolean,
  enabled: boolean
): SubagentOutputState {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const prevFileRef = useRef<string | undefined>(undefined);

  // Reset accumulated content when outputFile changes
  useEffect(() => {
    if (prevFileRef.current !== outputFile) {
      prevFileRef.current = outputFile;
      setContent("");
      setError(false);
    }
  }, [outputFile]);

  // Manage EventSource connection
  useEffect(() => {
    if (!enabled || !outputFile) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(false);

    const es = new EventSource(
      `/api/subagent-output?path=${encodeURIComponent(outputFile)}`
    );
    esRef.current = es;

    es.onopen = () => {
      setLoading(false);
      setError(false);
    };

    es.onmessage = (e) => {
      try {
        const data: { content?: string; error?: string } = JSON.parse(e.data);
        if (data.content) {
          setContent((prev) => prev + data.content);
        }
        if (data.error) {
          setError(true);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setError(true);
      setLoading(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [enabled, outputFile]);

  return { content, loading, error };
}
