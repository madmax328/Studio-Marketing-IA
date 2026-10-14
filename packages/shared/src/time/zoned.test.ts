import { describe, expect, it } from "vitest";
import { addDays, monthGrid, spreadSlots, toZoned, weekdayOf, zonedToUtc } from "./zoned";

describe("conversion heure locale → UTC", () => {
  it("convertit en hiver et en été à Paris", () => {
    const winter = zonedToUtc("2026-01-15", "12:00", "Europe/Paris");
    const summer = zonedToUtc("2026-07-15", "12:00", "Europe/Paris");
    expect(winter.ok && winter.instant.toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(summer.ok && summer.instant.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("refuse une heure qui n'existe pas (passage à l'heure d'été)", () => {
    expect(zonedToUtc("2026-03-29", "02:30", "Europe/Paris")).toEqual({ ok: false, reason: "nonexistent" });
  });

  it("retient la première occurrence d'une heure ambiguë (passage à l'heure d'hiver)", () => {
    const result = zonedToUtc("2026-10-25", "02:30", "Europe/Paris");
    expect(result.ok && result.instant.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("gère les fuseaux hors Europe", () => {
    const result = zonedToUtc("2026-06-01", "09:00", "America/Montreal");
    expect(result.ok && result.instant.toISOString()).toBe("2026-06-01T13:00:00.000Z");
  });

  it("refuse les dates impossibles", () => {
    expect(zonedToUtc("2026-02-30", "10:00", "Europe/Paris").ok).toBe(false);
    expect(zonedToUtc("2026-02-10", "25:00", "Europe/Paris").ok).toBe(false);
  });

  it("fait l'aller-retour", () => {
    const result = zonedToUtc("2026-10-14", "18:45", "Europe/Paris");
    expect(result.ok && toZoned(result.instant, "Europe/Paris")).toMatchObject({ date: "2026-10-14", time: "18:45", weekday: 3 });
  });
});

describe("calendrier", () => {
  it("calcule les jours", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(weekdayOf("2026-10-18")).toBe(7);
  });

  it("construit la grille d'un mois en semaines du lundi au dimanche", () => {
    const grid = monthGrid("2026-10");
    expect(grid[0]?.[0]).toBe("2026-09-28");
    expect(grid.at(-1)?.at(-1)).toBe("2026-11-01");
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("répartit les créneaux d'une campagne", () => {
    const slots = spreadSlots("2026-11-02", "2026-11-29", 3, "12:00");
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ date: "2026-11-02", time: "12:00" });
    expect(new Set(slots.map((s) => s.date)).size).toBe(12);
    expect(slots.every((s) => s.date >= "2026-11-02" && s.date <= "2026-11-29")).toBe(true);
  });
});
