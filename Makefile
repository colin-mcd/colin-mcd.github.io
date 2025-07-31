#SHELL := /bin/bash

#include ~/.ghc-wasm/env

GHC_FLAGS=-Wall -Wno-unused-matches -Wno-unused-local-binds -Wno-missing-signatures -Wno-name-shadowing -Wno-orphans -Wno-type-defaults
GHC_OBJ_FLAGS=--make -odir .objects -hidir .objects
GHC=ghc

#--export=a,--export=b,...
WASM_EXPORT=--export=hs_init,--export=myreduce,--export=mymarshal,--export=bohmout,--export=getCharPtrSize,--export=malloc,--export=free,--export=hs_perform_gc
WASM_GHC_FLAGS=-no-hs-main -optl-mexec-model=reactor -optl-Wl,$(WASM_EXPORT) -iUntypedLambda
WASM_ENV=$(HOME)/.ghc-wasm/env
WASM_GHC=$(shell . $(WASM_ENV); which wasm32-wasi-ghc)

all:
	echo $(WASM_GHC_FLAGS)
	$(WASM_GHC) Web.hs $(WASM_GHC_FLAGS) $(GHC_OBJ_FLAGS) -o Web.wasm $(GHC_FLAGS)
	$(shell $(WASM_GHC) --print-libdir)/post-link.mjs -i Web.wasm -o Web.js


.PHONY: clean
clean:
	rm -f .objects/* *.hi *.o *.wasm *_stub.hx
