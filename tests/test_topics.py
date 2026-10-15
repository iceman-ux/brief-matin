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
    """Trois répliques de même longueur, séparées par de vraies pauses de
    0,4 s : chaque sujet commence au milieu de la pause qui le précède."""

    def setUp(self):
        self.audio = silence(0.5) + tone(3) + silence(0.4) + tone(3) + silence(0.4) + tone(3)
        self.script = [{"speaker": "Marc", "text": "a" * 100},
                       {"speaker": "Léa", "text": "b" * 100, "topic": 1},
                       {"speaker": "Marc", "text": "c" * 100, "topic": 2}]

    def test_debuts_au_milieu_des_pauses(self):
        marks = tts.topic_marks(CFG, self.audio.tobytes(), self.script, 2)
        self.assertAlmostEqual(marks[0] / RATE, 3.7, delta=0.02)
        self.assertAlmostEqual(marks[1] / RATE, 7.1, delta=0.02)

    def test_sans_pause_nette_pas_de_debut_pour_ce_sujet_seulement(self):
        # Une seule pause, plus près de la place du sujet 2 (7,0 s) que de
        # celle du sujet 1 (3,8 s) : elle revient au sujet 2, le sujet 1
        # reste sans début.
        audio = silence(0.5) + tone(6.4) + silence(0.4) + tone(3)
        marks = tts.topic_marks(CFG, audio.tobytes(), self.script, 2)
        self.assertIsNone(marks[0])
        self.assertAlmostEqual(marks[1] / RATE, 7.1, delta=0.02)
        continuous = (silence(0.5) + tone(9.8)).tobytes()
        self.assertEqual(tts.topic_marks(CFG, continuous, self.script, 2), [None, None])

    def test_pause_trop_loin_de_la_place_attendue(self):
        # Une seule pause, à 12,7 s : à 8,5 s de la place attendue du sujet 1
        # (4,2 s), à 1,2 s de celle du sujet 2 (11,5 s).
        audio = silence(0.5) + tone(12) + silence(0.4) + tone(3.4)
        script = [{"speaker": "Marc", "text": "a" * 100},
                  {"speaker": "Léa", "text": "b" * 100, "topic": 1},
                  {"speaker": "Marc", "text": "c" * 100},
                  {"speaker": "Marc", "text": "d" * 100, "topic": 2},
                  {"speaker": "Marc", "text": "e" * 30}]
        marks = tts.topic_marks(CFG, audio.tobytes(), script, 2)
        self.assertIsNone(marks[0])
        self.assertAlmostEqual(marks[1] / RATE, 12.7, delta=0.02)

    def test_sujet_sans_replique_ou_dans_le_desordre(self):
        pcm = self.audio.tobytes()
        self.assertIsNone(tts.topic_marks(CFG, pcm, self.script, 3)[2])
        self.assertIsNone(tts.topic_marks(CFG, pcm, [dict(l, topic=None) for l in self.script], 2))
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


    def test_relation_bilaterale_dans_l_autre_pays(self):
        # Coopération militaire avec le Tchad : N'Djamena, ville frontière
        # du Cameroun, reste dans le Tchad ; Paris annoncée au Tchad, non.
        place = topics.clean_place(CFG, {"city": "N'Djamena", "country": "Tchad",
                                         "iso3": "TCD", "lat": 12.13, "lon": 15.06})
        self.assertEqual(place["tz"], "Africa/Ndjamena")
        self.assertIsNone(topics.clean_place(CFG, {"city": "Paris", "country": "Tchad",
                                                   "iso3": "TCD", "lat": 48.86, "lon": 2.35}))
        # Le Vatican est placé à Rome, Italie.
        self.assertIsNotNone(topics.clean_place(CFG, {"city": "Rome", "country": "Italie",
                                                      "iso3": "ITA", "lat": 41.90, "lon": 12.45}))
        prompt = (Path(__file__).parents[1] / "prompts" / "brief_fr.md").read_text(encoding="utf-8")
        self.assertIn("N'Djamena, Tchad", prompt)
        self.assertIn("Rome, Italie", prompt)


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
        partial = topics.enrich(CFG, raw, "2026-10-14", [None, 58.5], [])
        self.assertNotIn("start", partial[0])
        self.assertEqual(partial[1]["start"], 58.5)


class TrendTest(unittest.TestCase):
    TOPIC = {"slug": "budget-2027", "title": "Budget 2027 : vote", "articles": [4, 9, 12]}

    def test_jours_reels_seuls_et_null_sans_episode(self):
        episodes = [
            # Avant les numéros d'articles : hors de la courbe, pas zéro.
            {"date": "2026-10-09", "topics": [{"slug": "budget-2027", "title": "Ancien"}]},
            {"date": "2026-10-10", "topics": [{"slug": "budget-2027", "articles": [1, 2]},
                                              {"slug": "x", "title": "Budget 2027 : le Sénat", "articles": [2, 7]}]},
            {"date": "2026-10-11", "topics": [{"slug": "autre", "title": "Rien", "articles": [3]}]},
            # Le 12 : run raté, pas d'épisode.
            {"date": "2026-10-13", "topics": [{"slug": "budget-2027", "articles": [5]}]},
        ]
        self.assertEqual(topics.trend(CFG, self.TOPIC, "2026-10-14", episodes),
                         [3, 0, None, 1, 3])

    def test_pas_de_courbe_avant_trois_jours_connus(self):
        episodes = [{"date": "2026-10-13", "topics": [{"slug": "budget-2027", "articles": [5]}]}]
        self.assertIsNone(topics.trend(CFG, self.TOPIC, "2026-10-14", episodes))
        # Le jour sans épisode ne compte pas comme un jour connu.
        episodes.append({"date": "2026-10-11", "topics": [{"slug": "y", "articles": [1]}]})
        self.assertEqual(topics.trend(CFG, self.TOPIC, "2026-10-14", episodes), [0, None, 1, 3])
        self.assertIsNone(topics.trend(CFG, {"slug": "budget-2027"}, "2026-10-14", episodes))

    def test_fenetre_de_sept_jours(self):
        episodes = [{"date": f"2026-10-{d:02d}", "topics": [{"slug": "budget-2027", "articles": [1]}]}
                    for d in range(1, 14)]
        curve = topics.trend(CFG, self.TOPIC, "2026-10-14", episodes)
        self.assertEqual(curve, [1, 1, 1, 1, 1, 1, 3])

    def test_dans_le_flux_et_episodes(self):
        episodes = [{"date": f"2026-10-{d:02d}", "topics": [{"slug": "budget-2027", "articles": [1]}]}
                    for d in (12, 13)]
        result = topics.enrich(CFG, [dict(self.TOPIC)], "2026-10-14", None, episodes)
        self.assertEqual(result[0]["trend7d"], [1, 1, 3])
        self.assertEqual(result[0]["articles"], [4, 9, 12])
        app = topics.app_topics(result)[0]
        self.assertEqual(app["trend7d"], [1, 1, 3])
        self.assertNotIn("articles", app)


class WriterTest(unittest.TestCase):
    def test_numeros_d_articles_existants_seulement(self):
        data = writer.validate(CFG, {
            "topics": [{"title": "A", "articles": [3, 3, 1, 0, 99, True, "2"]},
                       {"title": "B", "articles": [99]},
                       {"title": "C", "articles": "1, 2"},
                       {"title": "D"}],
            "script": [{"speaker": "Léa", "text": "un"}]}, article_count=10)
        self.assertEqual(data["topics"][0]["articles"], [1, 3])
        for topic in data["topics"][1:]:
            self.assertNotIn("articles", topic)

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
        # Un sujet sans début reste dans le chapitre précédent.
        partial = topics.chapters(CFG, [{"title": "A", "start": 3}, {"title": "B"}, {"title": "C", "start": 90}])
        self.assertEqual([c["title"] for c in partial["chapters"]],
                         [CFG.raw["topics"]["intro_chapter"], "A", "C"])
        self.assertIsNone(topics.chapters(CFG, [{"title": "A"}, {"title": "B"}]))

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
