-- Phase 7: the unit types Nigerian listings use, from "Room and parlour" to "Mansion".
--
-- Reused as they are: room ("Single room"), self_contain ("Self contained"), mini_flat, shop, other.
-- Kept for units that already use them, but no longer offered for new units (src/lib/rent.ts):
-- flat and duplex, now split into "One bedroom flat" … and "Semi-detached" / "Detached duplex".
--
-- New values are placed so the enum's order matches the app's picker (rooms, flats and apartments,
-- houses), in case anything ever sorts by type. Adding enum values is safe for existing rows.

alter type public.unit_type add value if not exists 'room_and_parlour' before 'mini_flat';

alter type public.unit_type add value if not exists 'one_bedroom_flat' before 'flat';
alter type public.unit_type add value if not exists 'two_bedroom_flat' before 'flat';
alter type public.unit_type add value if not exists 'three_bedroom_flat' before 'flat';
alter type public.unit_type add value if not exists 'four_bedroom_flat' before 'flat';
alter type public.unit_type add value if not exists 'studio_apartment' before 'flat';
alter type public.unit_type add value if not exists 'apartment' before 'flat';
alter type public.unit_type add value if not exists 'penthouse' before 'flat';

alter type public.unit_type add value if not exists 'terrace_house' before 'duplex';
alter type public.unit_type add value if not exists 'townhouse' before 'duplex';
alter type public.unit_type add value if not exists 'semi_detached_duplex' before 'duplex';
alter type public.unit_type add value if not exists 'detached_duplex' before 'duplex';
alter type public.unit_type add value if not exists 'bungalow' before 'duplex';
alter type public.unit_type add value if not exists 'detached_bungalow' before 'duplex';
alter type public.unit_type add value if not exists 'villa' before 'duplex';
alter type public.unit_type add value if not exists 'mansion' before 'duplex';
