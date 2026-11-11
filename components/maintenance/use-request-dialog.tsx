"use client";

import { useState } from "react";

import { useNotice } from "@/components/feedback/notice";
import {
  MaintenanceRequestDialog,
  type RequestPreset,
} from "@/components/maintenance/request-form-dialog";
import type { MaintenanceRequest } from "@/types/maintenance";

type DialogState = { open: boolean; key: number; preset?: RequestPreset; request?: MaintenanceRequest };

/** Create and edit actions plus the dialog and confirmation they show. Render `dialogs` once. */
export function useRequestDialog() {
  const [dialog, setDialog] = useState<DialogState>({ open: false, key: 0 });
  const { showNotice, clearNotice } = useNotice();

  function openCreate(preset?: RequestPreset) {
    clearNotice();
    setDialog((state) => ({ open: true, key: state.key + 1, preset }));
  }

  function openEdit(request: MaintenanceRequest) {
    clearNotice();
    setDialog((state) => ({ open: true, key: state.key + 1, request }));
  }

  const editing = dialog.request;
  const dialogs = (
    <MaintenanceRequestDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        formKey={dialog.key}
        preset={dialog.preset}
        request={editing}
        onSaved={(saved) =>
          showNotice(
            !editing
              ? {
                  tone: "success",
                  title: "Maintenance request created",
                  message: `“${saved.title}” has been logged as Open.`,
                }
              : saved.updatedAt === editing.updatedAt
                ? { tone: "success", title: "No changes", message: "Nothing was changed." }
                : {
                    tone: "success",
                    title: "Request updated",
                    message: `Changes to “${saved.title}” are recorded in its history.`,
                  },
          )
        }
      />
  );

  return { openCreate, openEdit, showNotice, clearNotice, dialogs };
}
