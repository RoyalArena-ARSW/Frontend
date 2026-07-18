import { useParams } from 'react-router-dom';
import { PagePlaceholder } from '../../components/PagePlaceholder/PagePlaceholder';

export default function BattlePage() {
  const { matchId } = useParams();
  return <PagePlaceholder name={`Battle ${matchId}`} />;
}
