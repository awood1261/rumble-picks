import { getChampionPromotion } from "../../../lib/championData";
import { ChampionClaimPage } from "../../../components/ChampionClaimPage";

type ChampionPageProps = {
  params: Promise<{ promotionId: string }>;
};

export default async function ChampionPage({ params }: ChampionPageProps) {
  const { promotionId } = await params;
  const promotion = await getChampionPromotion(promotionId);
  return <ChampionClaimPage promotionId={promotionId} promotion={promotion} />;
}
