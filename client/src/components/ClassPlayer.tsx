import { useQuery } from "@tanstack/react-query";
import type { Pathway } from "@/data/content";
import { apiRequest } from "@/lib/queryClient";
import { PoseImage } from "@/components/PoseImage";
import { VideoPlayer } from "@/components/VideoPlayer";

/** Full-class media lives here; the pose-by-pose guided session keeps its own clock. */
export function ClassPlayer({ pathway }: { pathway: Pathway }) {
  const { data } = useQuery<{ video: { hls?: string | null; mp4?: string | null; playbackId?: string | null; playbackPolicy?: "public" | "signed"; captions?: string | null } | null }>({
    queryKey: ["/api/classes", pathway.slug, "media"],
    queryFn: async () => (await apiRequest("GET", `/api/classes/${encodeURIComponent(pathway.slug)}/media`)).json(),
    staleTime: 60_000,
    retry: false,
    refetchInterval: (query) => query.state.data?.video?.playbackPolicy === "signed" ? 10 * 60_000 : false,
  });
  return (
    <div data-testid="class-player">
      <VideoPlayer
        title={`${pathway.name} video`}
        videoUrl={data?.video?.playbackPolicy === "signed" ? data.video.hls : pathway.videoUrl || data?.video?.hls || data?.video?.mp4}
        playbackPolicy={data?.video?.playbackPolicy}
        playbackId={pathway.playbackId || data?.video?.playbackId}
        poster={`/poses/${pathway.targetImgSlug}.webp`}
        captions={data?.video?.captions ? [{ src: data.video.captions, srcLang: "en", label: "English", default: true }] : []}
        fallback={<PoseImage slug={pathway.targetImgSlug} rounded="rounded-xl" aspect="aspect-[4/3]" testId={`pathway-detail-hero-${pathway.slug}`} />}
      />
    </div>
  );
}
