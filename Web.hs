module Web where
-- import GHC.Wasm.Prim
import Foreign (mallocBytes, copyBytes)
import Foreign.C (CChar)
import Data.ByteString.Unsafe (unsafePackMallocCStringLen, unsafeUseAsCStringLen)
import Foreign.Ptr (Ptr, plusPtr)
import Foreign.Storable (peek)
import Data.Text.Encoding (decodeUtf8Lenient, encodeUtf8)
import Data.Text (pack, unpack)
import qualified UntypedLambda

--foreign import javascript unsafe "console.log($1)"
--  js_print :: JSString -> IO ()
--foreign import javascript unsafe "typeof $1 === 'object'"
--  js_is_obj :: JSVal -> Bool
--foreign import javascript unsafe "let acc = 1; for (let i = 1; i <= $1; ++i) acc *= i; return acc;"
--  js_fac :: Word -> Word

-- Adapted from https://github.com/AntanasKal/yampa-wasm-example/blob/e6c523049f409543c3db8340da0b88bd8832ab20/src/Game.hs
wrapStringFunction :: (String -> String) -> (Ptr CChar -> Int -> IO (Ptr CChar))
wrapStringFunction f inputPtr inputLen =
  unsafePackMallocCStringLen (inputPtr, inputLen) >>= \inputStr ->
  let outputStr = encodeUtf8 (pack (f (unpack (decodeUtf8Lenient inputStr)) ++ "\0")) in
  unsafeUseAsCStringLen outputStr $ \(outputBuf, outputLen) ->
  mallocBytes outputLen >>= \outputPtr ->
  copyBytes outputPtr outputBuf outputLen >>
  return outputPtr

foreign export ccall getCharPtrSize :: Ptr CChar -> IO Int
foreign export ccall myreduce ::  Ptr CChar -> Int -> IO (Ptr CChar)
foreign export ccall mymarshal :: Ptr CChar -> Int -> IO (Ptr CChar)
foreign export ccall bohmout :: Ptr CChar -> Int -> IO (Ptr CChar)

splitInput :: String -> Int -> Either String [String]
splitInput s expectedParts = expect (split s)
  where
    expect :: [String] -> Either String [String]
    expect ss =
      if length ss == expectedParts then
        Right ss
      else
        Left
          ("bad input: expected input to have "
           ++ show expectedParts
           ++ " parts, but got "
           ++ show (length ss)
           ++ "instead: "
           ++ show ss)
    
    -- split s by '§'
    split :: String -> [String]
    split s = split' s "" []
    
    -- split' "" "" acc = reverse acc
    split' "" cur acc = reverse (reverse cur : acc)
    -- split' ('§' : s) "" acc = split' s "" acc
    split' ('§' : s) cur acc = split' s "" (reverse cur : acc)
    split' (c : s) cur acc = split' s (c : cur) acc

getCharPtrSize ptr = h ptr 0 where
  h :: Ptr CChar -> Int -> IO Int
  h p acc = peek p >>= \c ->
    if toInteger c == 0 then
      return acc
    else
      h (plusPtr p 1) (acc + 1)

parseProgram :: String -> Either String UntypedLambda.Program
parseProgram s =
  UntypedLambda.lexStr s >>=
  UntypedLambda.parseOut UntypedLambda.parseProgram

parseReductionStrategy :: String -> String -> Either String UntypedLambda.ReductionStrategy
parseReductionStrategy "strict" "hnf" = Right UntypedLambda.CallByValue
parseReductionStrategy "lazy" "hnf" = Right UntypedLambda.CallByName
parseReductionStrategy "strict" "nf" = Right UntypedLambda.ApplOrder
parseReductionStrategy "lazy" "nf" = Right UntypedLambda.NormOrder
parseReductionStrategy order to = Left ("expected combination of \"strict|lazy\" and \"hnf|nf\" but got \"" ++ order ++ "\" and \"" ++ to ++ "\"")

parseBool :: String -> Either String Bool
parseBool "true" = Right True
parseBool "false" = Right False
parseBool b = Left ("expected \"True|False\" but got \"" ++ b ++ "\"")

myreduce' :: String -> String
myreduce' s =
  either ((++) "Error: ") id $
  splitInput s 5 >>= \[evalstep, evalorder, evalto, pmStr, tmStr] ->
  parseBool evalstep >>= \step ->
  parseReductionStrategy evalorder evalto >>= \rs ->
  parseProgram pmStr >>= \pm ->
  UntypedLambda.parseTerm tmStr >>= \tm ->
  let mp = UntypedLambda.progDefs pm in
  if step then
    return (unlines (UntypedLambda.stepsDiff tm (UntypedLambda.steps mp rs tm)))
  else
    return (show (UntypedLambda.reduce mp rs tm))

mymarshal' :: String -> String
mymarshal' s = s ++ " hi"

bohmout' :: String -> String
bohmout' s =
  either id show (parseInput s >>= bohm)
  where
    bohm :: (UntypedLambda.Program, UntypedLambda.Term, UntypedLambda.Term) -> Either String UntypedLambda.Term
    bohm (p, a, b) =
      maybe (Left "terms are equivalent") Right $
      UntypedLambda.makeDiscriminator (UntypedLambda.progDefs p) a b
    
    parseInput :: String -> Either String (UntypedLambda.Program, UntypedLambda.Term, UntypedLambda.Term)
    parseInput s =
      splitInput s 3 >>= \[programStr, aStr, bStr] ->
      pure (,,)
        <*> parseProgram programStr
        <*> UntypedLambda.parseTerm aStr <*> UntypedLambda.parseTerm bStr

myreduce = wrapStringFunction myreduce'
mymarshal = wrapStringFunction mymarshal'
bohmout = wrapStringFunction bohmout'
