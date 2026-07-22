import { useEffect } from "react";

/** Sets document.title for hash-routed pages (screen-reader orientation). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
