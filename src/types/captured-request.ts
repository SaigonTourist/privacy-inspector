export interface CapturedParam {
  key:       string
  value:     string    // valor original
  decoded?:  string    // valor decodificado (si aplica)
  label:     string    // nombre legible del parámetro
  meaning:   string    // qué significa en lenguaje humano
  sensitive: boolean   // si es dato sensible del usuario
}

export interface CapturedRequest {
  id:        string
  timestamp: number
  domain:    string
  company:   string
  method:    string
  params:    CapturedParam[]
}
