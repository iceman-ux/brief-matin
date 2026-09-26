"""Tests du contrôle de reprise, sans appel API.

    py -m unittest tests.test_fidelite
"""

import unittest
from datetime import date

from src import fidelite
from src.config import load_config
from src.sources import Item

CHAPO = ("Le gouvernement a annoncé jeudi une hausse de la taxe sur les "
         "billets d'avion à partir du premier janvier prochain.")


def item(title: str, summary: str = "", source: str = "Le Monde") -> Item:
    return Item(title=title, summary=summary, link="", source=source,
                category="france", weight=1, published="2026-09-26T00:00:00")


class CopyCheckTest(unittest.TestCase):
    def setUp(self):
        self.cfg = load_config()
        self.cfg.raw["fidelite"]["copy_min_words"] = 8
        self.cfg.raw["fidelite"]["quote_max_words"] = 20
        self.index = fidelite.index_sources(
            [item("Taxe sur les billets d'avion : le gouvernement tranche",
                  CHAPO)], 8)

    def check(self, text: str, number: int = 2):
        units = [{"id": number, "speaker": "Léa", "text": text, "lead": ""}]
        return fidelite.check_copies(self.cfg, units, self.index)

    def test_reprise_ignore_casse_accents_ponctuation(self):
        copies, _ = self.check("Donc : LE GOUVERNEMENT a annonce, jeudi, une "
                               "hausse de la taxe sur les billets.")
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0]["mots"], 13)
        self.assertEqual(copies[0]["champ"], "chapô")
        self.assertEqual(copies[0]["replique"], 2)

    def test_sept_mots_ne_suffisent_pas(self):
        copies, _ = self.check("Selon lui, une hausse de la taxe sur les "
                               "vols, pas plus.")
        self.assertEqual(copies, [])

    def test_huit_mots_suffisent(self):
        copies, _ = self.check("Il y aura une hausse de la taxe sur les "
                               "billets, en somme.")
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0]["texte"],
                         "une hausse de la taxe sur les billets")

    def test_reformulation_non_signalee(self):
        copies, _ = self.check("Prendre l'avion va coûter plus cher dès "
                               "janvier : l'exécutif augmente la taxe.")
        self.assertEqual(copies, [])

    def test_citation_courte_comptee_a_part(self):
        copies, quotes = self.check(
            "Le ministre l'a dit : « le gouvernement a annoncé jeudi une "
            "hausse de la taxe ». Voilà.")
        self.assertEqual(copies, [])
        self.assertEqual(len(quotes), 1)

    def test_citation_longue_controlee(self):
        long_quote = ("« " + CHAPO + " Et cela ne changera pas, quoi qu'en "
                      "disent les compagnies aériennes. »")
        copies, quotes = self.check(long_quote)
        self.assertEqual(quotes, [])
        self.assertEqual(len(copies), 1)

    def test_pas_de_suite_a_cheval_sur_une_citation(self):
        copies, _ = self.check("Le gouvernement a annoncé « jeudi » une "
                               "hausse de la taxe.")
        self.assertEqual(copies, [])

    def test_titre_et_chapo_ne_se_prolongent_pas(self):
        # La fin du titre suivie du début du chapô n'a jamais été écrite.
        copies, _ = self.check("Le gouvernement tranche le gouvernement a "
                               "annoncé mardi autre chose.")
        self.assertEqual(copies, [])


class UnitsTest(unittest.TestCase):
    def setUp(self):
        self.cfg = load_config()

    def test_date_de_la_marque_exclue_et_retablie(self):
        day = date(2026, 9, 26)
        script = [
            {"speaker": "Marc", "text": "Et aujourd'hui, samedi 26 septembre. "
                                        "Le fait du jour."},
            {"speaker": "Léa", "text": "Première réplique."},
            {"speaker": "Marc", "text": "Deuxième réplique."},
        ]
        units = fidelite.spoken_units(self.cfg, script, day)
        self.assertEqual(units[0]["text"], "Le fait du jour.")
        fixed = fidelite.apply_fixes(script, units, {1: "", 3: "Autre."})
        self.assertEqual(fixed[0]["text"], "Et aujourd'hui, samedi 26 septembre.")
        self.assertEqual(fixed[2], {"speaker": "Marc", "text": "Autre."})
        fixed = fidelite.apply_fixes(script, units, {2: ""})
        self.assertEqual(len(fixed), 2)

    def test_guard_sans_api_ne_bloque_jamais(self):
        # Sources illisibles : le garde-fou avertit et rend le script intact.
        script = [{"speaker": "Léa", "text": "Un texte."}]
        result, trace = fidelite.guard(self.cfg, script, [None], date(2026, 9, 26),
                                       use_api=False)
        self.assertIs(result, script)
        self.assertEqual(len(trace["erreurs"]), 1)


if __name__ == "__main__":
    unittest.main()
