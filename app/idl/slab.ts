/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/slab.json`.
 */
export type Slab = {
  "address": "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet",
  "metadata": {
    "name": "slab",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Slab catalog program for MagicBlock Ephemeral Rollups"
  },
  "instructions": [
    {
      "name": "commit",
      "discriminator": [
        223,
        140,
        142,
        165,
        229,
        208,
        156,
        74
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "crankCommit",
      "docs": [
        "Stamp catalog_root, then MagicIntent-commit with the delegated Slab as payer.",
        "No user signer. Magic invokes this crank. Wallet payers fail InvalidWritableAccount."
      ],
      "discriminator": [
        211,
        191,
        123,
        28,
        59,
        16,
        134,
        253
      ],
      "accounts": [
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "delegationRecord"
        },
        {
          "name": "magicFeeVault",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegate",
      "discriminator": [
        90,
        147,
        75,
        178,
        85,
        88,
        4,
        137
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferSlab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                61,
                68,
                44,
                96,
                38,
                3,
                89,
                233,
                89,
                151,
                145,
                75,
                244,
                117,
                25,
                2,
                58,
                116,
                111,
                10,
                78,
                32,
                179,
                34,
                238,
                138,
                56,
                225,
                200,
                89,
                22,
                201
              ]
            }
          }
        },
        {
          "name": "delegationRecordSlab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataSlab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "slab",
          "writable": true
        },
        {
          "name": "bufferCatalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "catalog"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                61,
                68,
                44,
                96,
                38,
                3,
                89,
                233,
                89,
                151,
                145,
                75,
                244,
                117,
                25,
                2,
                58,
                116,
                111,
                10,
                78,
                32,
                179,
                34,
                238,
                138,
                56,
                225,
                200,
                89,
                22,
                201
              ]
            }
          }
        },
        {
          "name": "delegationRecordCatalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "catalog"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataCatalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "catalog"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "catalog",
          "writable": true
        },
        {
          "name": "bufferIndex",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "index"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                61,
                68,
                44,
                96,
                38,
                3,
                89,
                233,
                89,
                151,
                145,
                75,
                244,
                117,
                25,
                2,
                58,
                116,
                111,
                10,
                78,
                32,
                179,
                34,
                238,
                138,
                56,
                225,
                200,
                89,
                22,
                201
              ]
            }
          }
        },
        {
          "name": "delegationRecordIndex",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "index"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataIndex",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "index"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "index",
          "writable": true
        },
        {
          "name": "bufferPagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pagePtr"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                61,
                68,
                44,
                96,
                38,
                3,
                89,
                233,
                89,
                151,
                145,
                75,
                244,
                117,
                25,
                2,
                58,
                116,
                111,
                10,
                78,
                32,
                179,
                34,
                238,
                138,
                56,
                225,
                200,
                89,
                22,
                201
              ]
            }
          }
        },
        {
          "name": "delegationRecordPagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pagePtr"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pagePtr"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pagePtr",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "ns",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pageNo",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegateIndex",
      "docs": [
        "Delegate one Index after `prepare_index`. Does not touch Slab or Catalog."
      ],
      "discriminator": [
        21,
        174,
        45,
        241,
        3,
        102,
        194,
        142
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "slab"
        },
        {
          "name": "bufferIndex",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "index"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                61,
                68,
                44,
                96,
                38,
                3,
                89,
                233,
                89,
                151,
                145,
                75,
                244,
                117,
                25,
                2,
                58,
                116,
                111,
                10,
                78,
                32,
                179,
                34,
                238,
                138,
                56,
                225,
                200,
                89,
                22,
                201
              ]
            }
          }
        },
        {
          "name": "delegationRecordIndex",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "index"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataIndex",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "index"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "index",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegatePage",
      "docs": [
        "Delegate one PagePtr after `prepare_page`. Does not touch Slab or Catalog."
      ],
      "discriminator": [
        36,
        113,
        62,
        5,
        230,
        52,
        17,
        231
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "slab"
        },
        {
          "name": "bufferPagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pagePtr"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                61,
                68,
                44,
                96,
                38,
                3,
                89,
                233,
                89,
                151,
                145,
                75,
                244,
                117,
                25,
                2,
                58,
                116,
                111,
                10,
                78,
                32,
                179,
                34,
                238,
                138,
                56,
                225,
                200,
                89,
                22,
                201
              ]
            }
          }
        },
        {
          "name": "delegationRecordPagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pagePtr"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pagePtr"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pagePtr",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pageNo",
          "type": "u32"
        }
      ]
    },
    {
      "name": "execCreateIndex",
      "discriminator": [
        213,
        244,
        20,
        205,
        131,
        152,
        161,
        148
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "slab"
          ]
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "attr",
          "type": "u8"
        },
        {
          "name": "relName",
          "type": "string"
        }
      ]
    },
    {
      "name": "execDrop",
      "discriminator": [
        95,
        133,
        105,
        239,
        91,
        180,
        34,
        190
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "slab"
          ]
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "relName",
          "type": "string"
        }
      ]
    },
    {
      "name": "execIndexDel",
      "discriminator": [
        65,
        225,
        26,
        224,
        244,
        110,
        72,
        132
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "slab",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "attr",
          "type": "u8"
        },
        {
          "name": "entries",
          "type": {
            "vec": {
              "defined": {
                "name": "pkSlot"
              }
            }
          }
        }
      ]
    },
    {
      "name": "execIndexPut",
      "discriminator": [
        229,
        128,
        219,
        3,
        76,
        58,
        252,
        186
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "slab",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "attr",
          "type": "u8"
        },
        {
          "name": "pageNo",
          "type": "u32"
        },
        {
          "name": "entries",
          "type": {
            "vec": {
              "defined": {
                "name": "pkSlot"
              }
            }
          }
        }
      ]
    },
    {
      "name": "execInsert",
      "discriminator": [
        121,
        226,
        82,
        74,
        236,
        241,
        146,
        82
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "pagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "arg",
                "path": "relOid"
              },
              {
                "kind": "arg",
                "path": "pageNo"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pageNo",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        },
        {
          "name": "relName",
          "type": "string"
        },
        {
          "name": "txid",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        },
        {
          "name": "hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "entries",
          "type": {
            "vec": {
              "defined": {
                "name": "pkSlot"
              }
            }
          }
        }
      ]
    },
    {
      "name": "execMutate",
      "discriminator": [
        3,
        90,
        9,
        177,
        15,
        47,
        134,
        83
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "pagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "arg",
                "path": "relOid"
              },
              {
                "kind": "arg",
                "path": "pageNo"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pageNo",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        },
        {
          "name": "relName",
          "type": "string"
        },
        {
          "name": "txid",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        },
        {
          "name": "hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nPageTuples",
          "type": "u16"
        },
        {
          "name": "nRelTuples",
          "type": "u32"
        },
        {
          "name": "removes",
          "type": {
            "vec": {
              "defined": {
                "name": "pkSlot"
              }
            }
          }
        },
        {
          "name": "adds",
          "type": {
            "vec": {
              "defined": {
                "name": "pkSlot"
              }
            }
          }
        }
      ]
    },
    {
      "name": "execSelect",
      "discriminator": [
        251,
        135,
        86,
        212,
        5,
        73,
        18,
        32
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "slab"
          ]
        },
        {
          "name": "slab",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "index"
        },
        {
          "name": "pagePtr",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "account",
                "path": "page_ptr.rel_oid",
                "account": "pagePtr"
              },
              {
                "kind": "account",
                "path": "page_ptr.page_no",
                "account": "pagePtr"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        },
        {
          "name": "pk",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "pkLen",
          "type": "u8"
        }
      ]
    },
    {
      "name": "execSql",
      "discriminator": [
        77,
        123,
        140,
        100,
        90,
        236,
        54,
        189
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "slab"
          ]
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        },
        {
          "name": "stmt",
          "type": {
            "defined": {
              "name": "sqlStmt"
            }
          }
        }
      ]
    },
    {
      "name": "grantWriter",
      "docs": [
        "Owner grants another pubkey INSERT / UPDATE / DELETE on this catalog.",
        "Create the Grant PDA on L1, paid by the fee vault. Do not `init` on the ER:",
        "that changes the undeleted fee payer (InvalidAccountForFee)."
      ],
      "discriminator": [
        238,
        123,
        4,
        214,
        233,
        71,
        43,
        179
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "grantee"
        },
        {
          "name": "slab"
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "grant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  114,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "account",
                "path": "grantee"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "ns"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "feeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "ns"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "ns",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "prepareIndex",
      "docs": [
        "Create an empty Index PDA on L1. Slab may already be DLP-owned."
      ],
      "discriminator": [
        26,
        224,
        112,
        103,
        128,
        88,
        195,
        56
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "slab"
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "index",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        }
      ]
    },
    {
      "name": "preparePage",
      "docs": [
        "Create an empty PagePtr PDA on L1. Call again for page_no 1, 2, …",
        "Slab may already be DLP-owned. Catalog owner or a granted writer may call this."
      ],
      "discriminator": [
        155,
        238,
        34,
        117,
        152,
        75,
        173,
        38
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "slab"
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "pagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "arg",
                "path": "relOid"
              },
              {
                "kind": "arg",
                "path": "pageNo"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pageNo",
          "type": "u32"
        }
      ]
    },
    {
      "name": "prepareRel",
      "docs": [
        "First table helper: Index + page 0. Extra pages use `prepare_page` only."
      ],
      "discriminator": [
        45,
        112,
        37,
        59,
        230,
        247,
        90,
        82
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "slab"
          ]
        },
        {
          "name": "slab",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "feeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "index",
          "writable": true
        },
        {
          "name": "pagePtr",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "arg",
                "path": "relOid"
              },
              {
                "kind": "arg",
                "path": "pageNo"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "relOid",
          "type": "u32"
        },
        {
          "name": "pageNo",
          "type": "u32"
        },
        {
          "name": "pkAttr",
          "type": "u8"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "reallocCatalog",
      "docs": [
        "Grow Catalog from 16 to 32 relation slots. Call on L1 (or ER if already delegated)."
      ],
      "discriminator": [
        57,
        5,
        52,
        32,
        28,
        102,
        249,
        218
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "slab"
          ]
        },
        {
          "name": "slab",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "revokeWriter",
      "docs": [
        "Owner removes a write grant. Close rent back to the L1 fee vault."
      ],
      "discriminator": [
        84,
        229,
        109,
        234,
        83,
        56,
        74,
        235
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "grantee"
        },
        {
          "name": "slab"
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "grant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  114,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              },
              {
                "kind": "account",
                "path": "grantee"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "scheduleCommitCrank",
      "docs": [
        "Schedule crank_commit on the ER. Send this transaction to the ER, not L1."
      ],
      "discriminator": [
        72,
        60,
        225,
        201,
        54,
        244,
        133,
        31
      ],
      "accounts": [
        {
          "name": "magicProgram"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "delegationRecord"
        },
        {
          "name": "magicFeeVault",
          "writable": true
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "scheduleCommitArgs"
            }
          }
        }
      ]
    },
    {
      "name": "undelegate",
      "discriminator": [
        131,
        148,
        180,
        198,
        91,
        104,
        42,
        238
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "slab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  108,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "slab.authority",
                "account": "slabAccount"
              },
              {
                "kind": "account",
                "path": "slab.ns",
                "account": "slabAccount"
              }
            ]
          }
        },
        {
          "name": "catalog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "slab"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "catalog",
      "discriminator": [
        175,
        32,
        23,
        106,
        77,
        71,
        227,
        200
      ]
    },
    {
      "name": "grant",
      "discriminator": [
        161,
        166,
        11,
        205,
        204,
        135,
        205,
        54
      ]
    },
    {
      "name": "index",
      "discriminator": [
        140,
        66,
        194,
        132,
        78,
        26,
        135,
        186
      ]
    },
    {
      "name": "pagePtr",
      "discriminator": [
        204,
        58,
        140,
        16,
        175,
        117,
        51,
        93
      ]
    },
    {
      "name": "slabAccount",
      "discriminator": [
        181,
        52,
        208,
        133,
        154,
        154,
        5,
        102
      ]
    }
  ],
  "events": [
    {
      "name": "selectHit",
      "discriminator": [
        9,
        244,
        141,
        65,
        128,
        204,
        240,
        33
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "syntaxError",
      "msg": "42601 syntax_error: statement is not in the v0 SQL subset"
    },
    {
      "code": 6001,
      "name": "programLimitExceeded",
      "msg": "54000 program_limit_exceeded"
    },
    {
      "code": 6002,
      "name": "relationExists",
      "msg": "relation already exists"
    },
    {
      "code": 6003,
      "name": "unknownType",
      "msg": "unknown column type"
    },
    {
      "code": 6004,
      "name": "invalidPrimaryKey",
      "msg": "primary key attribute is out of range"
    },
    {
      "code": 6005,
      "name": "invalidIdentifier",
      "msg": "identifier is empty or longer than the catalog field"
    },
    {
      "code": 6006,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6007,
      "name": "relationNotFound",
      "msg": "relation does not exist"
    },
    {
      "code": 6008,
      "name": "invalidRelOid",
      "msg": "relation oid must be the next catalog oid"
    },
    {
      "code": 6009,
      "name": "duplicateKey",
      "msg": "duplicate primary key"
    },
    {
      "code": 6010,
      "name": "rowNotFound",
      "msg": "row not found"
    },
    {
      "code": 6011,
      "name": "invalidPage",
      "msg": "page_no must append the heap"
    },
    {
      "code": 6012,
      "name": "invalidPointer",
      "msg": "txid must be a 32-64 byte Irys id, and hash must be non-zero"
    },
    {
      "code": 6013,
      "name": "invalidDelegationRecord",
      "msg": "delegation record or magic fee vault does not match the validator"
    },
    {
      "code": 6014,
      "name": "catalogGrown",
      "msg": "catalog is already grown to 32 tables"
    },
    {
      "code": 6015,
      "name": "notIndexed",
      "msg": "column is not indexed"
    },
    {
      "code": 6016,
      "name": "notGranted",
      "msg": "writer is not the catalog owner and has no GRANT"
    }
  ],
  "types": [
    {
      "name": "attr",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "typ",
            "type": "u8"
          },
          {
            "name": "notNull",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "catalog",
      "docs": [
        "Header + 16 relations at init (10 KiB create cap). `realloc_catalog` adds 16 more."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nRels",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "flags",
            "type": "u8"
          },
          {
            "name": "nextOid",
            "type": "u32"
          },
          {
            "name": "rels",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "rel"
                  }
                },
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "colType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bool"
          },
          {
            "name": "int4"
          },
          {
            "name": "int8"
          },
          {
            "name": "text"
          },
          {
            "name": "timestamptz"
          },
          {
            "name": "uuid"
          },
          {
            "name": "float8"
          },
          {
            "name": "jsonb"
          },
          {
            "name": "bytea"
          }
        ]
      }
    },
    {
      "name": "columnSpec",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "typ",
            "type": {
              "defined": {
                "name": "colType"
              }
            }
          },
          {
            "name": "notNull",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "grant",
      "docs": [
        "Write grant. PDA `[grant, slab, grantee]`. Owner is always a writer."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "slab",
            "type": "pubkey"
          },
          {
            "name": "grantee",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "index",
      "docs": [
        "PK or secondary index. Cap fits the 10 KiB inner-ix create limit."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nKeys",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "pkAttr",
            "type": "u8"
          },
          {
            "name": "relOid",
            "type": "u32"
          },
          {
            "name": "keys",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "indexEntry"
                  }
                },
                128
              ]
            }
          }
        ]
      }
    },
    {
      "name": "indexEntry",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "pageNo",
            "type": "u32"
          },
          {
            "name": "slot",
            "type": "u16"
          },
          {
            "name": "keyLen",
            "type": "u8"
          },
          {
            "name": "pad",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pagePtr",
      "docs": [
        "Pointer to an 8 KiB page on Irys. Row bytes never live here."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "relOid",
            "type": "u32"
          },
          {
            "name": "pageNo",
            "type": "u32"
          },
          {
            "name": "txid",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nTuples",
            "type": "u16"
          },
          {
            "name": "flags",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "createdSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pkSlot",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyLen",
            "type": "u8"
          },
          {
            "name": "slot",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "rel",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oid",
            "type": "u32"
          },
          {
            "name": "nPages",
            "type": "u32"
          },
          {
            "name": "nTuples",
            "type": "u32"
          },
          {
            "name": "nAttrs",
            "type": "u8"
          },
          {
            "name": "pkAttr",
            "type": "u8"
          },
          {
            "name": "idxMask",
            "docs": [
              "Bit i set means column i has an Index PDA."
            ],
            "type": "u16"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "attrs",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "attr"
                  }
                },
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scheduleCommitArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "taskId",
            "type": "i64"
          },
          {
            "name": "executionIntervalMillis",
            "type": "i64"
          },
          {
            "name": "iterations",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "selectHit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "relOid",
            "type": "u32"
          },
          {
            "name": "pageNo",
            "type": "u32"
          },
          {
            "name": "slot",
            "type": "u16"
          },
          {
            "name": "txid",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "slabAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "ns",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "catalogRoot",
            "docs": [
              "sha256 of the Catalog account bytes at the last commit."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "schemaVersion",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "flags",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sqlStmt",
      "docs": [
        "Structured SQL. The proxy parses Postgres text. The program never sees JOIN."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "createTable",
            "fields": [
              {
                "name": "name",
                "type": "string"
              },
              {
                "name": "columns",
                "type": {
                  "vec": {
                    "defined": {
                      "name": "columnSpec"
                    }
                  }
                }
              },
              {
                "name": "pkAttr",
                "type": "u8"
              }
            ]
          }
        ]
      }
    }
  ]
};
