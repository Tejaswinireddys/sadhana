/**
 * Standalone AI trainer lesson player for pose detail pages.
 *
 * Separate from PoseExplanation / REVIEWED_MOVEMENT_DEMOS: these clips are
 * pilot content with an honest "AI trainer preview" label, English captions,
 * and mobile-safe progressive playback (playsInline, poster, user-started).
 *
 * v3 lessons are portrait 9:16. The player must use object-fit: contain inside
 * a 9:16 box (never cover / never a landscape 16:9 shell) so head, arms and
 * feet stay on screen. On wide viewports the frame is centered and capped at
 * ~80vh instead of stretching edge-to-edge.
 */
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  AI_TRAINER_PREVIEW_LABEL,
  type AiTrainerLesson,
} from "@/data/aiTrainerLessons";

/** Shared shell for the portrait player and its loading poster. */
const PORTRAIT_SHELL =
  "mx-auto w-full max-w-[min(100%,calc(80vh*9/16))]";
const PORTRAIT_VIDEO =
  "aspect-[9/16] max-h-[80vh] w-full rounded-xl bg-card object-contain";

export function AiTrainerLesson({ lesson }: { lesson: AiTrainerLesson }) {
  const fallback = (
    <img
      src={lesson.poster}
      alt=""
      width={lesson.width}
      height={lesson.height}
      className={PORTRAIT_VIDEO}
      data-testid="ai-trainer-lesson-poster-fallback"
    />
  );

  return (
    <section
      className="space-y-2"
      data-testid="ai-trainer-lesson"
      data-slug={lesson.slug}
      data-aspect="9/16"
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
      <div className={`flex justify-center ${PORTRAIT_SHELL}`}>
        <VideoPlayer
          title={`${lesson.english} · ${AI_TRAINER_PREVIEW_LABEL}`}
          videoUrl={lesson.mp4}
          poster={lesson.poster}
          className="w-full"
          videoClassName={PORTRAIT_VIDEO}
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
