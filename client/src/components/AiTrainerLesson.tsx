/**
 * Standalone AI trainer lesson player for pose detail pages.
 *
 * Separate from PoseExplanation / REVIEWED_MOVEMENT_DEMOS: these clips are
 * pilot content with an honest "AI trainer preview" label, English captions,
 * and mobile-safe progressive playback (playsInline, poster, user-started).
 *
 * v3 files are tall slides with the trainer in a centered 16:9 band.
 * object-cover on a 16:9 frame crops the beige bars. The poster uses the
 * same crop so the frame is never blank while the file loads.
 */
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  AI_TRAINER_PORTRAIT_SHELL,
  AI_TRAINER_PORTRAIT_VIDEO,
  AI_TRAINER_PREVIEW_LABEL,
  type AiTrainerLesson,
} from "@/data/aiTrainerLessons";

export function AiTrainerLesson({ lesson }: { lesson: AiTrainerLesson }) {
  const fallback = (
    <img
      src={lesson.poster}
      alt=""
      width={lesson.width}
      height={lesson.height}
      className={AI_TRAINER_PORTRAIT_VIDEO}
      data-testid="ai-trainer-lesson-poster-fallback"
    />
  );

  return (
    <section
      className="space-y-2"
      data-testid="ai-trainer-lesson"
      data-slug={lesson.slug}
      data-aspect="16/9"
      data-fit="cover-center"
      aria-label={`${lesson.english} ${AI_TRAINER_PREVIEW_LABEL}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className="text-sm font-medium text-foreground"
          data-testid="ai-trainer-lesson-label"
        >
          {lesson.label}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="ai-trainer-lesson-duration">
          {lesson.durationHint}
        </p>
      </div>
      <p className="text-xs leading-snug text-muted-foreground" data-testid="ai-trainer-lesson-note">
        Photorealistic AI-generated trainer — pilot content for review, not a
        filmed or instructor-approved demonstration.
      </p>
      <div className={AI_TRAINER_PORTRAIT_SHELL}>
        <VideoPlayer
          title={`${lesson.english} · ${AI_TRAINER_PREVIEW_LABEL}`}
          videoUrl={lesson.mp4}
          poster={lesson.poster}
          className="flex w-full justify-center"
          videoClassName={AI_TRAINER_PORTRAIT_VIDEO}
          captions={[
            {
              src: lesson.captionsVtt,
              srcLang: "en",
              label: "English",
              default: true,
            },
          ]}
          fallback={fallback}
        />
      </div>
    </section>
  );
}
