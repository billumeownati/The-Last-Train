import { useUI } from '../store';
import { SceneHost } from './SceneHost';
import { Briefing, Landing, Lobby } from './Screens';
import { ActionBar, EffectsList, NavButtons, SidePanel, TopBar } from './Game';
import { ConductorMenu, ConnBanner, DiningVoteModal, Ending, EventModal, FinalVoteModal, PendingRevealModal, Rules, StationBanner, Toasts } from './Overlays';

function Screen() {
  const view = useUI((s) => s.view);
  if (!view) return <Landing />;
  switch (view.phase) {
    case 'lobby':
      return <Lobby />;
    case 'briefing':
      return <Briefing />;
    case 'ending':
      return <Ending />;
    default:
      return (
        <>
          <TopBar />
          <EffectsList />
          <NavButtons />
          <ActionBar />
          <SidePanel />
          <StationBanner />
          <EventModal />
          <DiningVoteModal />
          <FinalVoteModal />
          <ConductorMenu />
          <PendingRevealModal />
        </>
      );
  }
}

export function App() {
  return (
    <div className="app">
      <SceneHost />
      <div className="ui">
        <Screen />
      </div>
      <Toasts />
      <ConnBanner />
      <Rules />
    </div>
  );
}
