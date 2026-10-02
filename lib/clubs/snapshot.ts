import { db } from "@/lib/db";
import { formatLabel } from "@/lib/organizer/summary";
import { registrationPaymentPaid } from "@/lib/registrations/settings";

export async function clubPublicSnapshot(clubId: string) {
  const club = await db.getClub(clubId);
  if (!club) return null;
  const [teamIds, tournamentIds, coaches] = await Promise.all([
    db.listClubTeamIds(clubId),
    db.listClubTournamentIds(clubId),
    db.listClubCoaches(clubId),
  ]);
  const teams = [];
  const players = [];
  for (const tid of teamIds) {
    const team = await db.getTeam(tid);
    if (!team) continue;
    const roster = await db.listPlayers(tid);
    teams.push({
      id: team.id,
      name: team.name,
      short_name: team.short_name,
      sport: team.sport,
      city: team.city,
      coach: team.coach,
      player_count: roster.length,
    });
    for (const p of roster) {
      players.push({
        id: p.id,
        team_id: team.id,
        team_name: team.name,
        name: p.name,
        jersey_number: p.jersey_number,
        position: p.position,
        status: p.status,
      });
    }
  }
  const tournaments = [];
  for (const id of tournamentIds) {
    const t = await db.getPublicTournament(id);
    if (!t) continue;
    tournaments.push({
      id: t.id,
      title: t.title,
      format: t.format,
      formatLabel: formatLabel(t.format),
      teamCount: t.team_count,
      spectatorPaid: Boolean(t.state?.payment?.isPaid),
      registrationPaid: registrationPaymentPaid(t.state),
    });
  }
  return {
    club: {
      id: club.id,
      name: club.name,
      short_name: club.short_name,
      sport: club.sport,
      city: club.city,
      founded_year: club.founded_year,
      venue: club.venue,
      description: club.description,
      contact_name: club.contact_name,
      mobile: club.mobile,
      createdAt: club.created_at instanceof Date ? club.created_at.toISOString() : club.created_at,
    },
    teams,
    players,
    coaches: coaches.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      notes: c.notes,
    })),
    tournaments,
  };
}
