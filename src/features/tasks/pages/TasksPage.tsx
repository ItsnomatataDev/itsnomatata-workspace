import TasksWorkspacePage from "./TasksWorkspacePage";

export default function TasksPage() {
  return (
    <TasksWorkspacePage
      defaultBoardMode="organization"
      pageTitle="Task Management"
      pageDescription="Shared professional workflow cards for the organization."
      allowModeSwitch={true}
    />
  );
}
