import React, { useRef, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, X, FileText, ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";

export default function FileUploader({ attachments = [], onChange, testIdPrefix = "attach", label = "Attach Documents (PDF / Image)" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
        onChange([...(attachments || []), r.data]);
      }
      toast.success(`${files.length} file(s) attached`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (id) => onChange((attachments || []).filter((a) => a.id !== id));

  const resolveUrl = (u) => {
    if (!u) return "#";
    if (u.startsWith("http")) return u;
    // API_BASE ends with /api, url already starts with /api/uploads/… so strip /api first
    const base = API_BASE.replace(/\/api$/, "");
    return base + u;
  };

  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-slate-500">{label}</Label>
      <div className="mt-2 border border-dashed border-slate-300 rounded-md p-3 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={onFile}
            className="hidden"
            data-testid={`${testIdPrefix}-input`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            data-testid={`${testIdPrefix}-btn`}
            className="gap-2"
          >
            <Upload className="w-4 h-4" /> {busy ? "Uploading…" : "Choose Files"}
          </Button>
          <span className="text-xs text-slate-500">PDF / PNG / JPG, up to 10 MB each</span>
        </div>
        {(attachments || []).length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between bg-white border border-slate-200 rounded px-3 py-1.5 text-sm">
                <a href={resolveUrl(a.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline min-w-0">
                  {a.content_type?.includes("pdf") ? <FileText className="w-4 h-4 shrink-0" /> : <ImageIcon className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{a.filename}</span>
                  <span className="text-xs text-slate-400 shrink-0">({Math.round((a.size || 0) / 1024)} KB)</span>
                </a>
                <button onClick={() => remove(a.id)} className="text-slate-400 hover:text-red-500 ml-2 shrink-0"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
