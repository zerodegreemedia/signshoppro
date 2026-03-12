import { useState } from "react";
import { Check, MessageSquareText, Loader2 } from "lucide-react";
import { useUpdateProofStatus } from "@/hooks/useProofs";
import { useUpdateJobStatus } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import type { Proof } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProofApprovalProps {
  proof: Proof;
  jobId: string;
}

export function ProofApproval({ proof, jobId }: ProofApprovalProps) {
  const { user } = useAuth();
  const updateProofStatus = useUpdateProofStatus();
  const updateJobStatus = useUpdateJobStatus();

  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [clientNotes, setClientNotes] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);

  // Don't show actions if proof is already approved
  if (proof.status === "approved") {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="font-medium">This proof has been approved</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPending = updateProofStatus.isPending || updateJobStatus.isPending;

  const handleApprove = () => {
    if (!user) return;
    updateProofStatus.mutate(
      {
        proofId: proof.id,
        jobId,
        status: "approved",
      },
      {
        onSuccess: () => {
          setConfirmApprove(false);
          updateJobStatus.mutate({
            jobId,
            newStatus: "proof_approved",
            changedBy: user.id,
            notes: `Proof v${proof.version} approved by client`,
          });
        },
      }
    );
  };

  const handleRequestChanges = () => {
    if (!user || !clientNotes.trim()) return;
    updateProofStatus.mutate(
      {
        proofId: proof.id,
        jobId,
        status: "revision_requested",
        clientNotes: clientNotes.trim(),
      },
      {
        onSuccess: () => {
          setShowRevisionForm(false);
          setClientNotes("");
          updateJobStatus.mutate({
            jobId,
            newStatus: "proof_revision_requested",
            changedBy: user.id,
            notes: `Client requested changes on proof v${proof.version}`,
          });
        },
      }
    );
  };

  return (
    <>
      <Card>
        <CardContent className="py-4 space-y-3">
          {!showRevisionForm ? (
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-base"
                onClick={() => setConfirmApprove(true)}
                disabled={isPending}
              >
                <Check className="mr-2 h-5 w-5" />
                Approve This Proof
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 h-12 text-base"
                onClick={() => setShowRevisionForm(true)}
                disabled={isPending}
              >
                <MessageSquareText className="mr-2 h-5 w-5" />
                Request Changes
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="client-feedback">
                What changes would you like?
              </Label>
              <Textarea
                id="client-feedback"
                placeholder="Please describe what needs to change..."
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowRevisionForm(false);
                    setClientNotes("");
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleRequestChanges}
                  disabled={isPending || !clientNotes.trim()}
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit Feedback
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm approval dialog */}
      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve This Proof?</AlertDialogTitle>
            <AlertDialogDescription>
              Once approved, production will begin. This cannot be undone. Are
              you sure this proof is ready?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Yes, Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
