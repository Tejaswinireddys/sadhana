/**
 * Standalone AI trainer lesson player for pose detail pages.
 *
 * Separate from PoseExplanation / REVIEWED_MOVEMENT_DEMOS: these clips are
 * pilot content with an honest "AI trainer preview" label, English captions,
 * and mobile-safe progressive playback (playsInline, poster, user-started).
 */
import { VideoPlayer } from "@/components/VideoPlayer";
import { PoseImage } from "@/components/PoseImage";
import {
  AI_TRAINER_PREVIEW_LABEL,
  type AiTrainerLesson,
} from "@/data/aiTrainerLessons";

export function AiTrainerLesson({ lesson }: { lesson: AiTrainerLesson }) {
  const fallback = (
    <PoseImage
      slug={lesson.slug}
      alt={`${lesson.english} illustration`}
      className="w-full bg-card"
      rounded="rounded-xl"
      aspect="aspect-video"
      breath={false}
      shadow={false}
    />
  );

  return (
    <section
      className="space-y-2"
      data-testid="ai-trainer-lesson"
      data-slug={lesson.slug}
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
      <VideoPlayer
        title={`${lesson.english} · ${AI_TRAINER_PREVIEW_LABEL}`}
        videoUrl={lesson.mp4}
        poster={lesson.poster}
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
    </section>
  );
}
