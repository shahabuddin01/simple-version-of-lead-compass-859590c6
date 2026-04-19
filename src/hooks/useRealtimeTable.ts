import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime postgres changes on one or more tables.
 * Calls `onChange` (debounced) whenever any change happens.
 */
export function useRealtimeTable(
  tables: string | string[],
  onChange: () => void,
  channelName?: string
) {
  useEffect(() => {
    const tableList = Array.isArray(tables) ? tables : [tables];
    const name = channelName || `rt-${tableList.join("-")}-${Math.random().toString(36).slice(2, 8)}`;

    let timer: number | null = null;
    const debounced = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { onChange(); }, 250);
    };

    let channel = supabase.channel(name);
    tableList.forEach(table => {
      channel = channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        debounced
      );
    });
    channel.subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(",") : tables]);
}
