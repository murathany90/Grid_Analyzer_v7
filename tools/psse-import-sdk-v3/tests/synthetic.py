"""Original, redistributable synthetic fixtures. No Siemens model content."""
import copy


def bridge():
    return {
        "schemaVersion": "ga-psse-bridge/1",
        "metadata": {"sourceFile": "synthetic.rawx", "sourceSha256": "1"*64,
                     "sourceFormat": "RAWX", "extractionMethod": "standalone-rawx-parser",
                     "timestampUtc": "2026-10-26T00:00:00Z", "sourceFidelity": "SOURCE_EXACT", "unsupportedEquipment": []},
        "caseIdentification": {"sbaseMva": 100., "baseFrequencyHz": 50., "solutionStatus": {"isSolved": False, "state": "UNKNOWN"}},
        "network": {
            "buses": [{"ibus": i, "name": f"SYNTH_{i}", "baskv": 110., "ide": 3 if i == 1 else 1,
                       "vmPu": 1., "vaDeg": 0., "area": 1, "zone": 1, "owner": 1} for i in (1,2,3)],
            "branches": [{"fromBus": 1, "toBus": 2, "circuitId": "A", "inService": True,
                          "rPu": .01, "xPu": .1, "bPu": .02, "rateMva": 100., "rateSet": [100.,110.,120.]+[0.]*9,
                          "fromShuntGpu": .001, "fromShuntBpu": .002, "toShuntGpu": .003, "toShuntBpu": .004,
                          "lengthKm": 0., "meteredBus": 1, "isBypassed": False}],
            "transformers": [{"fromBus": 1, "toBus": 3, "tertiaryBus": None, "circuitId": "T", "inService": True,
                              "isThreeWinding": False, "controlMode": 0, "controlledBus": 0, "statusCode": 1,
                              "winding1": winding(1.1, 10.), "winding2": winding(.98, 2.), "winding3": None,
                              "impedance": {"r12Pu": .01, "x12Pu": .12, "sbase12Mva": 100.},
                              "magnetizing": {"gPu": .0001, "bPu": -.002}}],
            "generators": [{"ibus": 1, "machid": "G", "inService": True, "pMw": 50., "qMvar": 20.,
                            "pMinMw": 0., "pMaxMw": 100., "qMinMvar": -50., "qMaxMvar": 50.,
                            "mbaseMva": 120., "vsPu": 1., "remoteBus": 0, "remoteNode": 0, "zrPu": .01, "zxPu": .2}],
            "loads": [{"ibus": 2, "loadid": "L", "inService": True, "pMw": 50., "qMvar": 20.,
                       "pCurrentMw": 0., "qCurrentMvar": 0., "pAdmittanceMw": 0., "qAdmittanceMvar": 0.}],
            "fixedShunts": [{"ibus": 2, "shuntId": "F", "inService": True, "gMw": .1, "bMvar": 2.}],
            "switchedShunts": [{"ibus": 3, "shuntId": "S", "inService": True, "controlMode": 0, "controlledBus": 0,
                                "bInitMvar": 5., "blocks": [{"inService": True, "numSteps": 2, "stepBMvar": 2.5}]}],
            "areas": [{"areaNumber": 1, "slackBus": 1}], "zones": [{"zoneNumber": 1}], "owners": [{"ownerNumber": 1}],
            "substations": [], "substationNodes": [], "substationSwitches": []}}


def winding(ratio=1., angle=0.):
    return {"ratioPu": ratio, "angleDeg": angle, "nominalKv": 110., "rateMva": 100., "rateSet": [100.,110.]+[0.]*10}


def three_winding():
    b = bridge(); t = b["network"]["transformers"][0]
    t.update(tertiaryBus=2, isThreeWinding=True, winding3=winding(1.02,-4.))
    t["impedance"].update(r23Pu=.02, x23Pu=.14, r31Pu=.03, x31Pu=.16, sbase23Mva=100., sbase31Mva=100.)
    return b


def rawx():
    """Small v36 source, independently authored and round-trippable."""
    def table(fields, rows): return {"fields": fields.split(), "data": rows}
    return {"general": {"version": "36.5"}, "network": {
        "caseid": table("ic sbase rev xfrrat nxfrat basfrq title1 title2", [0,100.,36,0,0,50.,"SYNTHETIC SDK TEST",""]),
        "bus": table("ibus name baskv ide vm va", [[1,"REFERENCE",110.,3,1.,0.],[2,"DEMAND",110.,1,1.,0.]]),
        "generator": table("ibus machid stat pg qg qt qb vs mbase pt pb", [[1,"G",1,10.,2.,50.,-50.,1.,100.,100.,0.]]),
        "load": table("ibus loadid stat pl ql ip iq yp yq", [[2,"L",1,10.,2.,0.,0.,0.,0.]]),
        "acline": table("ibus jbus ckt rpu xpu bpu stat name gi bi gj bj met len " + " ".join(f"rate{i}" for i in range(1,13)),
                        [[1,2,"A",.01,.1,.02,1,"SYNTHETIC",0.,0.,0.,0.,1,0.]+[100.]*12])}}


def raw():
    return "\n".join([
        "0,100,36,0,0,50", "SYNTHETIC SDK TEST", "",
        "1,'REFERENCE',110,3,1,1,1,1,0,1.1,.9,1.1,.9", "2,'DEMAND',110,1,1,1,1,1,0,1.1,.9,1.1,.9",
        "0 / END OF BUS DATA, BEGIN LOAD DATA", "2,'L',1,1,1,10,2,0,0,0,0,1,1,0,'LOAD'",
        "0 / END OF LOAD DATA, BEGIN GENERATOR DATA", "1,'G',10,2,50,-50,1,0,0,100,.01,.2,0,0,1,1,100,100,0,0,1,1",
        "0 / END OF GENERATOR DATA, BEGIN BRANCH DATA", "1,2,'A',.01,.1,.02,'123',"+','.join(['100']*12)+",0,0,0,0,1,0,1,0,1,1",
        "0 / END OF BRANCH DATA", "Q", ""])
