"""Données des sujets pour l'app : débuts calés sur les pauses, lieu
contrôlé, sujets liés, accroche, chapitres et éléments du flux.

Lancement : py -m unittest tests.test_topics
"""

from __future__ import annotations

import array
import json
import math
import unittest
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

from src import brand, feed, topics, tts, writer
from src.config import load_config

CFG = load_config(None)
RATE = int(CFG.audio["sample_rate"])
FIXTURE = Path(__file__).parent / "fixtures" / "lora-topics-item.xml"
NAMESPACES = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
              "podcast": "https://podcastindex.org/namespace/1.0",
              "lora": CFG.raw["topics"]["namespace"]}


def tone(seconds: float, amplitude: int = 8000) -> array.array:
    return array.array("h", (int(amplitude * math.sin(2 * math.pi * 220 * i / RATE))
                             for i in range(int(seconds * RATE))))


def silence(seconds: float) -> array.array:
    return array.array("h", bytes(2 * int(seconds * RATE)))


class TopicMarksTest(unittest.TestCase):
    """Trois répliques de même longueur, séparées par de vraies pauses : le
    sujet 2 commence à la troisième, à la reprise de voix après 0,4 s."""

    def setUp(self):
        self.audio = silence(0.5) + tone(3) + silence(0.4) + tone(3) + silence(0.4) + tone(3)
        self.script = [{"speaker": "Marc", "text": "a" * 100},
                       {"speaker": "Léa", "text": "b" * 100, "topic": 1},
                       {"speaker": "Marc", "text": "c" * 100, "topic": 2}]

    def test_debuts_sur_les_reprises_de_voix(self):
        marks = tts.topic_marks(CFG, self.audio.tobytes(), self.script, 2)
        self.assertIsNotNone(marks)
        self.assertAlmostEqual(marks[0] / RATE, 3.9, delta=0.02)
        self.assertAlmostEqual(marks[1] / RATE, 7.3, delta=0.02)

    def test_sans_pause_proche_aucun_debut(self):
        continuous = (silence(0.5) + tone(9.8)).tobytes()
        self.assertIsNone(tts.topic_marks(CFG, continuous, self.script, 2))

    def test_sujet_sans_replique_ou_dans_le_desordre(self):
        pcm = self.audio.tobytes()
        self.assertIsNone(tts.topic_marks(CFG, pcm, self.script, 3))
        shuffled = [dict(self.script[0]), {**self.script[1], "topic": 2},
                    {**self.script[2], "topic": 1}]
        self.assertIsNone(tts.topic_marks(CFG, pcm, shuffled, 2))

    def test_le_montage_decale_sans_alterer_le_corps(self):
        """Un instant du corps se retrouve à + décalage dans l'épisode monté
        (sonal, ouverture, clôture), échantillon pour échantillon."""
        body = silence(0.3) + tone(4, 6000) + silence(0.3)
        framed, shift = tts.frame(CFG, body.tobytes(), date(2026, 10, 14))
        out = array.array("h")
        out.frombytes(framed)
        for k in (int(1.0 * RATE), int(2.5 * RATE) + 7):
            self.assertEqual(out[k + shift], body[k])


class PlaceTest(unittest.TestCase):
    def test_lieu_valide_avec_fuseau(self):
        place = topics.clean_place(CFG, {"city": "Kyiv", "country": "Ukraine",
                                         "iso3": "ukr", "lat": 50.4501, "lon": 30.5234})
        self.assertEqual(place, {"city": "Kyiv", "country": "Ukraine", "iso3": "UKR",
                                 "lat": 50.45, "lon": 30.52, "tz": "Europe/Kyiv"})

    def test_hors_du_pays_annonce(self):
        self.assertIsNone(topics.clean_place(CFG, {"city": "Kyiv", "country": "France",
                                                   "iso3": "FRA", "lat": 50.45, "lon": 30.52}))

    def test_ville_cotiere_juste_hors_du_trace(self):
        # Le port de Marseille, sur la côte : dans la tolérance.
        self.assertIsNotNone(topics.clean_place(CFG, {"city": "Marseille", "country": "France",
                                                      "iso3": "FRA", "lat": 43.30, "lon": 5.36}))

    def test_lieu_incomplet_ou_absurde(self):
        for raw in (None, "Paris", {"city": "Paris", "iso3": "FRA", "lat": 48.85},
                    {"city": "X", "country": "Y", "iso3": "ZZZ", "lat": 1, "lon": 1},
                    {"city": "X", "country": "France", "iso3": "FRA", "lat": 95, "lon": 2},
                    {"city": "X", "country": "France", "iso3": "FRA", "lat": True, "lon": 2}):
            self.assertIsNone(topics.clean_place(CFG, raw), raw)


class RelatedTest(unittest.TestCase):
    def test_meme_slug_ou_titre_proche_dans_les_sept_jours(self):
        episodes = [
            {"date": "2026-10-13", "topics": [{"slug": "budget-2027", "title": "Le budget arrive"},
                                              {"slug": "x", "title": "Rien à voir"}]},
            {"date": "2026-10-10", "topics": [{"slug": "autre", "title": "Budget 2027 : le Sénat amende"}]},
            {"date": "2026-10-06", "topics": [{"slug": "budget-2027", "title": "Trop ancien"}]},
            {"date": "2026-10-14", "topics": [{"slug": "budget-2027", "title": "Le jour même"}]},
        ]
        topic = {"slug": "budget-2027", "title": "Budget 2027 : vote à l'Assemblée"}
        self.assertEqual(topics.related_count(CFG, topic, "2026-10-14", episodes), 2)
        self.assertEqual(topics.related_count(CFG, {"slug": "neuf", "title": "Inédit"},
                                              "2026-10-14", episodes), 0)


class EnrichTest(unittest.TestCase):
    def test_champs_absents_plutot_que_null(self):
        raw = [{"slug": "a", "title": "A", "sources": ["RFI"], "place": None},
               {"slug": "b", "title": "B", "sources": ["Le Monde"],
                "place": {"city": "Kyiv", "country": "Ukraine", "iso3": "UKR", "lat": 50.45, "lon": 30.52}}]
        result = topics.enrich(CFG, raw, "2026-10-14", [12.0, 58.5], [])
        self.assertNotIn("place", result[0])
        self.assertEqual(result[0]["start"], 12.0)
        self.assertEqual(result[1]["place"]["tz"], "Europe/Kyiv")
        self.assertEqual(result[1]["related7d"], 0)
        no_starts = topics.enrich(CFG, raw, "2026-10-14", None, [])
        self.assertNotIn("start", no_starts[0])


class WriterTest(unittest.TestCase):
    def test_numero_de_sujet_garde_seulement_s_il_existe(self):
        data = writer.validate(CFG, {
            "topics": [{"title": "A"}, {"title": "B"}],
            "script": [{"speaker": "Léa", "topic": 1, "text": "un"},
                       {"speaker": "Marc", "topic": 3, "text": "deux"},
                       {"speaker": "Marc", "topic": "2", "text": "trois"},
                       {"speaker": "Léa", "topic": True, "text": "quatre"},
                       {"speaker": "Léa", "topic": 2, "text": "cinq"}]})
        self.assertEqual([line.get("topic") for line in data["script"]], [1, None, None, None, 2])


class HookTest(unittest.TestCase):
    def test_accroche_sans_la_date_ni_le_clin_d_oeil(self):
        day = date(2026, 10, 14)
        lead = f"{CFG.brand['date_lead']} {brand.spoken_date(day)}"
        script = [{"speaker": "Marc", "text": f"{lead} L'Assemblée adopte la loi."}]
        self.assertEqual(brand.spoken_hook(CFG, script, day), "L'Assemblée adopte la loi.")
        script = [{"speaker": "Marc", "text": f"{lead} Bonne fête. Le fait."}]
        self.assertEqual(brand.spoken_hook(CFG, script, day, "Bonne fête."), "Le fait.")


def sample_episode() -> dict:
    """Le brief réel du 11/10 (titres et sources), avec les lieux et les
    débuts que le pipeline produit désormais."""
    raw = [
        {"slug": "guerre-ukraine-politique", "title": "Trump réclame un nouveau président ukrainien",
         "sources": ["Le Monde", "franceinfo"],
         "place": {"city": "Kyiv", "country": "Ukraine", "iso3": "UKR", "lat": 50.45, "lon": 30.52}},
        {"slug": "arabie-saoudite-attaque-riyad", "title": "Aéroport de Riyad frappé par un missile",
         "sources": ["Le Monde", "France 24", "RFI"],
         "place": {"city": "Riyad", "country": "Arabie saoudite", "iso3": "SAU", "lat": 24.71, "lon": 46.68}},
        {"slug": "cyclisme-tour-de-lombardie", "title": "Paul Seixas s'impose en Lombardie",
         "sources": ["franceinfo"], "place": None},
    ]
    return {"date": "2026-10-11", "hook": "Donald Trump réclame un nouveau président à Kyiv, et les Européens s'inquiètent.",
            "topics": topics.enrich(CFG, raw, "2026-10-11", [16.2, 58.4, 141.0], [])}


class FeedTest(unittest.TestCase):
    def item(self) -> ET.Element:
        episode = sample_episode()
        has = topics.chapters(CFG, episode["topics"]) is not None
        xml = (f'<rss xmlns:itunes="{NAMESPACES["itunes"]}" xmlns:podcast="{NAMESPACES["podcast"]}" '
               f'xmlns:lora="{NAMESPACES["lora"]}"><item>'
               f'{feed.item_extensions(CFG, episode, has)}</item></rss>')
        return ET.fromstring(xml).find("item")

    def test_accroche_en_sous_titre(self):
        self.assertEqual(self.item().findtext("itunes:subtitle", namespaces=NAMESPACES),
                         sample_episode()["hook"])

    def test_chapitres(self):
        element = self.item().find("podcast:chapters", NAMESPACES)
        self.assertEqual(element.get("url"),
                         f"{CFG.base_url}/chapters/brief-2026-10-11.json")
        self.assertEqual(element.get("type"), "application/json+chapters")
        doc = topics.chapters(CFG, sample_episode()["topics"])
        self.assertEqual(doc["version"], "1.2.0")
        self.assertEqual([c["startTime"] for c in doc["chapters"]], [0, 16.2, 58.4, 141.0])
        self.assertEqual(doc["chapters"][0]["title"], CFG.raw["topics"]["intro_chapter"])
        self.assertIsNone(topics.chapters(CFG, [{"title": "A", "start": 3}, {"title": "B"}]))

    def test_sujets_pour_l_app(self):
        data = json.loads(self.item().findtext("lora:topics", namespaces=NAMESPACES))
        self.assertEqual(data[0], {
            "title": "Trump réclame un nouveau président ukrainien", "start": 16.2,
            "place": {"city": "Kyiv", "country": "Ukraine", "iso3": "UKR",
                      "lat": 50.45, "lon": 30.52, "tz": "Europe/Kyiv"},
            "sources": ["Le Monde", "franceinfo"], "related7d": 0})
        self.assertNotIn("place", data[2])
        self.assertNotIn("slug", data[0])

    def test_cdata_ne_se_ferme_pas_dans_un_titre(self):
        episode = {"date": "2026-10-11", "topics": [{"title": "a ]]> b"}]}
        xml = (f'<rss xmlns:lora="{NAMESPACES["lora"]}"><item>'
               f'{feed.item_extensions(CFG, episode, False)}</item></rss>')
        text = ET.fromstring(xml).find("item").findtext("lora:topics", namespaces=NAMESPACES)
        self.assertEqual(json.loads(text), [{"title": "a ]]> b"}])

    def test_exemple_relu_par_l_app(self):
        """L'exemple figé est relu par le test de l'app (app/tests) : il doit
        rester celui que le pipeline produit."""
        expected = feed.item_extensions(CFG, sample_episode(), True).strip()
        self.assertEqual(FIXTURE.read_text(encoding="utf-8").strip(), expected)

    def test_dates_courtes(self):
        self.assertEqual(feed._short_date("2026-10-12"), "Lun. 12 oct.")
        self.assertEqual(feed._short_date("2026-06-02"), "Mar. 2 juin")
        self.assertEqual(feed._minutes(184), "3 min 04")


if __name__ == "__main__":
    unittest.main()
