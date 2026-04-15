"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ReasonModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  placeholder?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export default function ReasonModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  placeholder = "Enter reason...",
  loading = false,
  onClose,
  onConfirm,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Reason is required.");
      return;
    }
    setError(null);
    await onConfirm(trimmed);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1E293B]/30 backdrop-blur-md p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-lg bg-[#EEF4F9] border border-[#9ABDDC]/45 shadow-xl rounded-xl p-6"
          >
            <h2 className="text-xl font-semibold text-[#1E293B]">{title}</h2>
            <p className="text-sm text-[#1E293B]/75 mt-2">{description}</p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-[#1E293B] mb-2">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder={placeholder}
                className="w-full px-4 py-2 text-[#1E293B] bg-white border border-[#9ABDDC]/55 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9ABDDC] resize-none"
                disabled={loading}
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-[#1E293B] bg-white hover:bg-[#EEF4F9] rounded border border-[#9ABDDC]/55 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-[#1E293B] bg-[#9ABDDC] hover:bg-[#86adcF] rounded border border-[#9ABDDC]/70 transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting..." : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
