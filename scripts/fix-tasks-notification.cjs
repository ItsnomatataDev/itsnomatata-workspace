const fs = require("fs");
const path = "src/lib/supabase/mutations/tasks.ts";
let content = fs.readFileSync(path, "utf8");

const marker = `      await supabase.from("task_assignees").insert(
        fields.assigneeIds.map((userId) => ({
          organization_id: assigneeOrganizationId,
          task_id: taskId,
          user_id: userId,
        })),
      );
    }
  }

  return data as TaskRow;
}`;

const replacement = `      await supabase.from("task_assignees").insert(
        fields.assigneeIds.map((userId) => ({
          organization_id: assigneeOrganizationId,
          task_id: taskId,
          user_id: userId,
        })),
      );

      // Notify all (re)assigned users
      try {
        const assigneeNotifications = fields.assigneeIds.map((userId) =>
          notifyTaskAssigned({
            organizationId: assigneeOrganizationId,
            userId,
            taskId,
            taskTitle: data.title,
          }),
        );
        await Promise.all(assigneeNotifications);
      } catch (notifError) {
        console.error("Failed to send task assignment notifications:", notifError);
      }
    }
  }

  return data as TaskRow;
}`;

if (!content.includes(marker)) {
  console.error("Marker not found");
  process.exit(1);
}

// Replace only the LAST occurrence (the one in updateTask, not createTask)
const lastIndex = content.lastIndexOf(marker);
if (lastIndex === -1) {
  console.error("Last occurrence not found");
  process.exit(1);
}

content =
  content.substring(0, lastIndex) +
  replacement +
  content.substring(lastIndex + marker.length);
fs.writeFileSync(path, content);
console.log("Updated successfully");
