import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { EverhourCalendarEvent } from "./EverhourCalendar";

type UserTimeDetailsModalProps = {
  event: EverhourCalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function UserTimeDetailsModal({
  event,
  isOpen,
  onClose,
}: UserTimeDetailsModalProps) {
  if (!event) return null;

  const { resource } = event;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Time Tracked for {resource.userName} on{" "}
            {event.start.toLocaleDateString()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Hours:</span>
            <span>{resource.totalHours.toFixed(2)}h</span>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Projects:</h4>
            {resource.projects.length > 0 ? (
              <div className="space-y-2">
                {resource.projects.map((project, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {project.projectName || "No Project"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {project.isBillable ? "Billable" : "Non-billable"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {project.hours.toFixed(2)}h
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No projects found for this day.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
