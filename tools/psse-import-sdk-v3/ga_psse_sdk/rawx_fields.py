"""RAWX network-domain table order and field names (names only).

Field names follow the public PSS(R)E RAWX layout (Data Formats Reference Manual).
"""

TABLE_ORDER = ['caseid', 'general', 'gauss', 'newton', 'adjust', 'tysl', 'solver', 'rating', 'swdratnam', 'bus', 'load', 'fixshunt', 'voltagedroop', 'generator', 'swdratset', 'acline', 'sysswd', 'transformer', 'area', 'twotermdc', 'vscdc', 'impcor', 'ntermdc', 'ntermdcconv', 'ntermdcbus', 'ntermdclink', 'msline', 'zone', 'iatrans', 'owner', 'facts', 'swshunt', 'gne', 'indmach', 'loadtype', 'interface', 'itfelmt', 'sub', 'subnode', 'subswd', 'subterm']

FIELDS = {
    'caseid': ['ic', 'sbase', 'rev', 'xfrrat', 'nxfrat', 'basfrq', 'title1', 'title2'],
    'general': ['thrshz', 'pqbrak', 'blowup', 'maxisollvls', 'camaxreptsln', 'chkdupcntlbl'],
    'gauss': ['itmx', 'accp', 'accq', 'accm', 'tol'],
    'newton': ['itmxn', 'accn', 'toln', 'vctolq', 'vctolv', 'dvlim', 'ndvfct'],
    'adjust': ['adjthr', 'acctap', 'taplim', 'swvbnd', 'mxtpss', 'mxswim'],
    'tysl': ['itmxty', 'accty', 'tolty'],
    'solver': ['method', 'actaps', 'areain', 'phshft', 'dctaps', 'swshnt', 'flatst', 'varlim', 'nondiv'],
    'rating': ['irate', 'name', 'desc'],
    'swdratnam': ['irate', 'rnam', 'rtyp', 'unit', 'desc'],
    'bus': ['ibus', 'name', 'baskv', 'ide', 'area', 'zone', 'owner', 'vm', 'va', 'nvhi', 'nvlo', 'evhi', 'evlo'],
    'load': ['ibus', 'loadid', 'stat', 'area', 'zone', 'pl', 'ql', 'ip', 'iq', 'yp', 'yq', 'owner', 'scale', 'intrpt', 'dgenp', 'dgenq', 'dgenm', 'loadtype', 'name'],
    'fixshunt': ['ibus', 'shntid', 'stat', 'gl', 'bl', 'name'],
    'voltagedroop': ['name', 'status', 'regbus', 'qdb', 'qmin', 'qmax', 'vdblow', 'vdbhigh', 'vlow', 'vhigh'],
    'generator': ['ibus', 'machid', 'pg', 'qg', 'qt', 'qb', 'vs', 'ireg', 'nreg', 'mbase', 'zr', 'zx', 'rt', 'xt', 'gtap', 'stat', 'rmpct', 'pt', 'pb', 'baslod', 'o1', 'f1', 'o2', 'f2', 'o3', 'f3', 'o4', 'f4', 'wmod', 'wpf', 'droopname', 'name'],
    'swdratset': ['rsetnam', 'desc', 'rate1', 'rate2', 'rate3', 'rate4', 'rate5', 'rate6', 'rate7', 'rate8', 'rate9', 'rate10', 'rate11', 'rate12'],
    'acline': ['ibus', 'jbus', 'ckt', 'rpu', 'xpu', 'bpu', 'name', 'rate1', 'rate2', 'rate3', 'rate4', 'rate5', 'rate6', 'rate7', 'rate8', 'rate9', 'rate10', 'rate11', 'rate12', 'gi', 'bi', 'gj', 'bj', 'stat', 'bp', 'met', 'len', 'o1', 'f1', 'o2', 'f2', 'o3', 'f3', 'o4', 'f4'],
    'sysswd': ['ibus', 'jbus', 'ckt', 'xpu', 'rsetnam', 'stat', 'nstat', 'met', 'stype', 'name'],
    'transformer': ['ibus', 'jbus', 'kbus', 'ckt', 'cw', 'cz', 'cm', 'mag1', 'mag2', 'nmet', 'name', 'stat', 'o1', 'f1', 'o2', 'f2', 'o3', 'f3', 'o4', 'f4', 'vecgrp', 'zcod', 'r1_2', 'x1_2', 'sbase1_2', 'r2_3', 'x2_3', 'sbase2_3', 'r3_1', 'x3_1', 'sbase3_1', 'vmstar', 'anstar', 'windv1', 'nomv1', 'ang1', 'wdg1rate1', 'wdg1rate2', 'wdg1rate3', 'wdg1rate4', 'wdg1rate5', 'wdg1rate6', 'wdg1rate7', 'wdg1rate8', 'wdg1rate9', 'wdg1rate10', 'wdg1rate11', 'wdg1rate12', 'cod1', 'cont1', 'node1', 'rma1', 'rmi1', 'vma1', 'vmi1', 'ntp1', 'tab1', 'cr1', 'cx1', 'cnxa1', 'windv2', 'nomv2', 'ang2', 'wdg2rate1', 'wdg2rate2', 'wdg2rate3', 'wdg2rate4', 'wdg2rate5', 'wdg2rate6', 'wdg2rate7', 'wdg2rate8', 'wdg2rate9', 'wdg2rate10', 'wdg2rate11', 'wdg2rate12', 'cod2', 'cont2', 'node2', 'rma2', 'rmi2', 'vma2', 'vmi2', 'ntp2', 'tab2', 'cr2', 'cx2', 'cnxa2', 'windv3', 'nomv3', 'ang3', 'wdg3rate1', 'wdg3rate2', 'wdg3rate3', 'wdg3rate4', 'wdg3rate5', 'wdg3rate6', 'wdg3rate7', 'wdg3rate8', 'wdg3rate9', 'wdg3rate10', 'wdg3rate11', 'wdg3rate12', 'cod3', 'cont3', 'node3', 'rma3', 'rmi3', 'vma3', 'vmi3', 'ntp3', 'tab3', 'cr3', 'cx3', 'cnxa3'],
    'area': ['iarea', 'isw', 'pdes', 'ptol', 'arname'],
    'twotermdc': ['name', 'mdc', 'rdc', 'setvl', 'vschd', 'vcmod', 'rcomp', 'delti', 'met', 'dcvmin', 'cccitmx', 'cccacc', 'ipr', 'nbr', 'anmxr', 'anmnr', 'rcr', 'xcr', 'ebasr', 'trr', 'tapr', 'tmxr', 'tmnr', 'stpr', 'icr', 'ndr', 'ifr', 'itr', 'idr', 'xcapr', 'ipi', 'nbi', 'anmxi', 'anmni', 'rci', 'xci', 'ebasi', 'tri', 'tapi', 'tmxi', 'tmni', 'stpi', 'ici', 'ndi', 'ifi', 'iti', 'idi', 'xcapi'],
    'vscdc': ['name', 'mdc', 'rdc', 'o1', 'f1', 'o2', 'f2', 'o3', 'f3', 'o4', 'f4', 'ibus1', 'type1', 'mode1', 'dcset1', 'acset1', 'aloss1', 'bloss1', 'minloss1', 'smax1', 'imax1', 'pwf1', 'maxq1', 'minq1', 'vsreg1', 'nreg1', 'rmpct1', 'ibus2', 'type2', 'mode2', 'dcset2', 'acset2', 'aloss2', 'bloss2', 'minloss2', 'smax2', 'imax2', 'pwf2', 'maxq2', 'minq2', 'vsreg2', 'nreg2', 'rmpct2'],
    'impcor': ['itable', 'tap', 'refact', 'imfact'],
    'ntermdc': ['name', 'nconv', 'ndcbs', 'ndcln', 'mdc', 'vconv', 'vcmod', 'vconvn'],
    'ntermdcconv': ['name', 'ib', 'nbrdg', 'angmx', 'angmn', 'rc', 'xc', 'ebas', 'tr', 'tap', 'tpmx', 'tpmn', 'tstp', 'setvl', 'dcpf', 'marg', 'cnvcod'],
    'ntermdcbus': ['name', 'idc', 'ib', 'area', 'zone', 'dcname', 'idc2', 'rgrnd', 'owner'],
    'ntermdclink': ['name', 'idc', 'jdc', 'dcckt', 'met', 'rdc', 'ldc'],
    'msline': ['ibus', 'jbus', 'mslid', 'met', 'dum1', 'dum2', 'dum3', 'dum4', 'dum5', 'dum6', 'dum7', 'dum8', 'dum9'],
    'zone': ['izone', 'zoname'],
    'iatrans': ['arfrom', 'arto', 'trid', 'ptran'],
    'owner': ['iowner', 'owname'],
    'facts': ['name', 'ibus', 'jbus', 'mode', 'pdes', 'qdes', 'vset', 'shmx', 'trmx', 'vtmn', 'vtmx', 'vsmx', 'imx', 'linx', 'rmpct', 'owner', 'set1', 'set2', 'vsref', 'fcreg', 'nreg', 'mname'],
    'swshunt': ['ibus', 'shntid', 'modsw', 'adjm', 'stat', 'vswhi', 'vswlo', 'swreg', 'nreg', 'rmpct', 'rmidnt', 'binit', 'name', 's1', 'n1', 'b1', 's2', 'n2', 'b2', 's3', 'n3', 'b3', 's4', 'n4', 'b4', 's5', 'n5', 'b5', 's6', 'n6', 'b6', 's7', 'n7', 'b7', 's8', 'n8', 'b8'],
    'gne': ['name', 'model', 'nterm', 'bus1', 'bus2', 'nreal', 'nintg', 'nchar', 'stat', 'owner', 'nmet', 'real1', 'real2', 'real3', 'real4', 'real5', 'real6', 'real7', 'real8', 'real9', 'real10', 'intg1', 'intg2', 'intg3', 'intg4', 'intg5', 'intg6', 'intg7', 'intg8', 'intg9', 'intg10', 'char1', 'char2', 'char3', 'char4', 'char5', 'char6', 'char7', 'char8', 'char9', 'char10'],
    'indmach': ['ibus', 'imid', 'stat', 'sc', 'dc', 'area', 'zone', 'owner', 'name', 'tc', 'bc', 'mbase', 'ratekv', 'pcode', 'pset', 'hconst', 'aconst', 'bconst', 'dconst', 'econst', 'ra', 'xa', 'xm', 'r1', 'x1', 'r2', 'x2', 'x3', 'e1', 'se1', 'e2', 'se2', 'ia1', 'ia2', 'xamult'],
    'loadtype': ['name', 'desc'],
    'interface': ['name', 'inum', 'type', 'ratmax1', 'ratmax2', 'ratmax3', 'ratmax4', 'ratmax5', 'ratmax6', 'ratmax7', 'ratmax8', 'ratmax9', 'ratmax10', 'ratmax11', 'ratmax12', 'ratmin1', 'ratmin2', 'ratmin3', 'ratmin4', 'ratmin5', 'ratmin6', 'ratmin7', 'ratmin8', 'ratmin9', 'ratmin10', 'ratmin11', 'ratmin12'],
    'itfelmt': ['name', 'type', 'inum', 'jnum', 'knum', 'namid', 'dirctn', 'imet', 'weight'],
    'sub': ['isub', 'name', 'lati', 'long', 'srg'],
    'subnode': ['isub', 'inode', 'name', 'ibus', 'stat', 'vm', 'va'],
    'subswd': ['isub', 'inode', 'jnode', 'swdid', 'name', 'type', 'stat', 'nstat', 'xpu', 'rsetnam'],
    'subterm': ['isub', 'inode', 'type', 'eqid', 'ibus', 'jbus', 'kbus'],
}

RAWX_FIELDS = FIELDS
