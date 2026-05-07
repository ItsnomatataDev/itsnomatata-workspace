import AttendanceClockCard from "./AttendanceClockCard";

export default function ClockInOutCard({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}) {
  return <AttendanceClockCard userId={userId} organizationId={organizationId} />;
}
