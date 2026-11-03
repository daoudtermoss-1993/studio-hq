import type { OfficeLabels } from "@/components/Office";
import type { T } from "./i18n";

export function officeLabels(t: T): OfficeLabels {
  return {
    library: t.library, lessonsLearned: t.lessonsLearned, noMeetingYet: t.noMeetingYet, lastMeeting: t.lastMeeting,
    meetingRoom: t.meetingRoom, weeklyMeeting: t.weeklyMeeting, booth: t.booth, you: t.you,
    toRecord: t.toRecord(0).replace("0", "{n}"), working: t.working, tasks: t.tasks,
    strategyRoom: t.strategyRoom, weeklyFocus: t.weeklyFocus,
  };
}
