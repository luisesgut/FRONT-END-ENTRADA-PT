import React, { useState, useEffect } from 'react';
import './salidaMP.scss';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faWeight, faCubes, faRuler, faTag } from '@fortawesome/free-solid-svg-icons';


// Definimos los tipos para Producto
interface Producto {
    id?: number;
    urlImagen: string;
    fecha: string;
    area: string;
    claveProducto: string;
    nombreProducto: string;
    pesoBruto: string | number;
    pesoNeto: string | number;
    pesoTarima: string | number;
    piezas: string | number;
    uom: string;
    fechaEntrada: string;
    productPrintCard: string;
    horaEntrada: string;
}

// Definimos los tipos para ProductoMP
interface ProductoMP {
    TipoEtiqueta?: string;
    Calibre?: string;
    ClaveOperador: string;
    ClaveProducto: string;
    CodigoBobina?: string;
    FechaProduccion?: Date;
    FechaCreacion: Date;
    Impresora: string;
    OperadorNombre: string;
    Peso?: number;
    Piezas?: number;
    ProductoNombre: string;
    RFID: string;
    Id: number;
    Status: string;
    Trazabilidad: string;
    TipoBobina: string;
    TipoCaja?: string;
    TipoVaso?: string;
    TipoZipper?: string;
    TipoProducto: string;
    Medida?: string;
}

interface TarimaData {
    epc: string;
    AntennaPort: number;
    RSSI: string;
    FirstSeenTime: string;
    LastSeenTime: string;
    ReaderIP: string;
    OperadorInfo: OperadorInfo;
}

interface OperadorInfo {
    id: number;
    claveOperador: string;
    nombreOperador: string;
    rfiD_Operador: string;
}

const SalidaMP: React.FC = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
    const [nombreOperador, setNombreOperador] = useState<string>("Sin operador asociado");
    const [statusOk, setStatusOk] = useState<boolean>(false); // Para indicar si el estado fue actualizado correctamente
    const [registroEntrada, setRegistroEntrada] = useState<boolean>(false); // Para indicar si el registro en SAP (extraInfo) fue exitoso
    // Estado para el reloj
    const [currentTime, setCurrentTime] = useState(new Date());
    const [cantidadProductos, setCantidadProductos] = useState(0);
    // const metaDiaria = 100; // Meta diaria de productos procesados

     useEffect(() => {
         const timer = setInterval(() => {
             setCurrentTime(new Date());
         }, 1000); // Actualiza cada segundo
 
         return () => clearInterval(timer); // Limpia el temporizador al desmontar
     }, []);
 
     const formatTime = (date: Date) => {
         return date.toLocaleTimeString('es-ES', { hour12: true }); // Formato de hora español (24 horas o 12 horas)
     };

    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("http://172.16.10.31:86/message")
            .configureLogging(signalR.LogLevel.Information)
            .build();

        connection.start()
            .then(() => {
                console.log("Conectado");
                connection.invoke("JoinGroup", "EntradaMP")
                    .then(() => console.log("Unido al grupo EntradaMP"))
                    .catch(err => console.error("Error al unirse al grupo:", err));
            })
            .catch((err) => {
                console.error("Error de conexión:", err);
                // Swal.fire('Error', 'Conexión a SignalR fallida', 'error');
            });

        connection.on("sendEpc", (tarima: any) => {
            if (tarima && tarima.epc) {
                const epc = tarima.epc.replace(/\s+/g, '');  // Quita todos los espacios
                console.log(`Tarima recibida con EPC: ${epc}`);
                updateStatus(epc, 8);
                fetchData(epc);
                loadDataPT(epc, setProductos);
                extraInfo(epc);
                //registroAntenas(tarima.epc, "000000000134");
                if (tarima.OperadorInfo && tarima.OperadorInfo.rfiD_Operador) {
                    fetchOperadorInfo(tarima.OperadorInfo.rfiD_Operador);
                    console.log(`Operador detectado: ${tarima.OperadorInfo.nombreOperador}`);
                } else {
                    setNombreOperador("Sin operador asociado");
                    console.log("Sin operador asociado");
                }
            }
        });

        return () => {
            if (connection.state === signalR.HubConnectionState.Connected) {
                connection.invoke("LeaveGroup", "EntradaMP")
                    .then(() => connection.stop())
                    .catch(err => console.error("Error al salir del grupo:", err));
            } else {
                connection.stop();
            }
        };
    }, []);

    // Actualizar el producto más reciente automáticamente si no hay uno seleccionado manualmente
    useEffect(() => {
        if (productos.length > 0 && !productoSeleccionado) {
            const ultimoProducto = productos[0]; // El más reciente es el primer producto en el arreglo
            setProductoSeleccionado(ultimoProducto);
            console.log("Producto seleccionado automáticamente:", ultimoProducto);
        }
    }, [productos, productoSeleccionado]);
    



    // Modificación en la función fetchData
const fetchData = async (epc: string): Promise<Producto | ProductoMP | null> => {
    try {
        const response = await fetch(`http://172.16.10.31/api/socket/prueba/${epc}`);
        if (!response.ok) {
            throw new Error('Error al obtener los datos');
        }
        
        const data = await response.json();
        console.log("Tipo de Etiqueta:", data.TipoEtiqueta);

        // Verificamos el tipo de etiqueta para retornar el tipo correspondiente
        if (data.TipoEtiqueta === "EtiquetaMP") {
            return data as ProductoMP; // Cargar ProductoMP si es TipoEtiqueta "EtiquetaMP"
        } else {
            return data as Producto; // Cargar Producto si es cualquier otro tipo
        }
    } catch (error) {
        console.error("Error al realizar la petición:", error);
        return null;
    }
};



//MP
// Nueva función loadDataMP para manejar los datos de ProductoMP
const loadDataMP = async (data: ProductoMP, setProductosMP: React.Dispatch<React.SetStateAction<ProductoMP[]>>) => {
    try {
        if (data && data.TipoEtiqueta === "EtiquetaMP") {
            // Procesar y cargar los datos de ProductoMP
            const nuevoProductoMP: ProductoMP = {
                ClaveOperador: data.ClaveOperador || 'N/A',
                ClaveProducto: data.ClaveProducto || 'N/A',
                ProductoNombre: data.ProductoNombre || 'N/A',
                RFID: data.RFID || 'N/A',
                Id: data.Id || 0,
                Status: data.Status || 'N/A',
                Trazabilidad: data.Trazabilidad || 'N/A',
                TipoProducto: data.TipoProducto || 'N/A',
                FechaCreacion: data.FechaCreacion || new Date(),
                OperadorNombre: data.OperadorNombre || 'N/A',
                Impresora: data.Impresora || 'N/A',
                TipoEtiqueta: data.TipoEtiqueta || 'N/A',
                TipoBobina: data.TipoBobina || 'N/A',  // Aquí agregas la propiedad 'TipoBobina'
            };

            // Actualizar el estado con el nuevo producto
            setProductosMP(prevProductosMP => [nuevoProductoMP, ...prevProductosMP]);
            console.log("ProductoMP cargado correctamente:", nuevoProductoMP);
        }
    } catch (error) {
        console.error("Error al cargar los datos de ProductoMP:", error);
    }
};


//PT
const loadDataPT = async (data: Producto, setProductos: React.Dispatch<React.SetStateAction<Producto[]>>) => {
    try {
        
        if (data) {
            const horaActual = new Date().toLocaleTimeString();  // Obtener la hora actual correctamente
            
            let imageString = 'https://calibri.mx/bioflex/wp-content/uploads/2024/03/standup_pouch.png'; // URL por defecto si no hay imagen

            try {
                const imageResponse = await fetch(`http://172.16.10.31/api/Image/${data.productPrintCard}`);
                if (imageResponse.ok) {
                    const imageData = await imageResponse.json();
                    imageString = imageData.imageBase64 || imageString;  // Actualizar solo si se obtiene una imagen válida
                } else {
                    console.error(`Error al obtener la imagen: ${imageResponse.statusText}`);
                }
            } catch (imageError) {
                console.error("Error al cargar la imagen:", imageError);
            }

            // Agregar el nuevo producto al principio de la lista
            const nuevoProducto = {
                urlImagen: imageString,
                fecha: data.fecha || 'N/A',
                area: data.area || 'N/A',
                claveProducto: data.claveProducto || 'N/A',
                nombreProducto: data.nombreProducto || 'N/A',
                pesoBruto: data.pesoBruto || 'N/A',
                pesoNeto: data.pesoNeto || 'N/A',
                pesoTarima: data.pesoTarima || 'N/A',
                piezas: data.piezas || 'N/A',
                uom: data.uom || 'N/A',
                fechaEntrada: data.fechaEntrada || 'N/A',
                productPrintCard: data.productPrintCard || 'N/A',
                horaEntrada: horaActual
            };

            setProductos((prevProductos) => {
                // Verificar si el producto con el mismo EPC ya existe
                const productoYaRegistrado = prevProductos.some((producto) => producto.productPrintCard === data.productPrintCard);
                
                if (!productoYaRegistrado) {
                    // Si el producto no existe, lo agregamos al principio de la lista
                    const productosActualizados = [nuevoProducto, ...prevProductos];
                    setCantidadProductos(prev => prev + 1);
                    setProductoSeleccionado(nuevoProducto);  // Selecciona automáticamente el nuevo producto
                    console.log("Producto más reciente seleccionado automáticamente:", nuevoProducto);
                    return productosActualizados;
                } else {
                    // Si el producto ya existe, seleccionamos el producto existente como el más reciente
                    const productoExistente = prevProductos.find((producto) => producto.productPrintCard === data.productPrintCard);
                    setProductoSeleccionado(productoExistente || nuevoProducto);
                    return prevProductos;  // No se actualiza la lista, ya que el producto ya está registrado
                }
            });
        }
    } catch (error) {
        console.error("Error al cargar los datos del EPC:", error);
    }
};

// Función para cambiar el estado

const updateStatus = async (epc: string, newStatus: number) => {
    try {
        const response = await fetch(`http://172.16.10.31/api/RfidLabel/UpdateStatusByRFID/PT_MP/PRUEBA/${epc}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            setStatusOk(true); // Estado actualizado correctamente
            console.log(`Estado actualizado correctamente para el EPC: ${epc}`);
            
        } else {
            setStatusOk(false); // Error al actualizar el estado
            console.error(`Error al actualizar el status para el EPC: ${epc}`);
            
        }
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
    }
};

//Actualización de registro en ProdExtraInfo
const extraInfo = async (epc: string) => {
    try {
        const response = await fetch(`http://172.16.10.31/api/ProdExtraInfo/SalidaAlmacen/${epc}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}) // El cuerpo está vacío según lo que has mencionado
        });

        if (response.ok) {
            const responseData = await response.json();
        }
        
    } catch (error) {
        console.error("Error al registrar en SAP:", error);
        setRegistroEntrada(false);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al registrar en SAP',
            timer: 2500,
            showConfirmButton: false
        });
    }
};


//Registro en tabla RegistroAntenas
const registroAntenas = async (epc: string, epcOperador: string) => {
    try {
        const response = await fetch(`http://172.16.10.31/api/ProdRegistroAntenas?epcOperador=${epcOperador}&epc=${epc}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}) // El cuerpo está vacío según lo que has mencionado
        });

        
    } catch (error) {
        console.error("Error al registrar:", error);
    
    }
};


//FUNCION PARA SACAR AL OPERADOR
// Función para obtener datos del operador
const fetchOperadorInfo = async (epcOperador: string) => {
    try {
        const response = await fetch(`http://172.16.10.31/api/OperadoresRFID/${epcOperador}`);
        if (response.ok) {
            const data: OperadorInfo = await response.json();
            setNombreOperador(data.nombreOperador);
            console.log(`Nombre del operador obtenido: ${data.nombreOperador}`);
        } else {
            setNombreOperador("Operador no encontrado");
            console.error("Operador no encontrado");
        }
    } catch (error) {
        setNombreOperador("Error al obtener operador");
        console.error("Error al obtener los datos del operador:", error);
    }
};    


    
const formatFecha = () => {
    const fechaActual = new Date();
  
    // Opciones para formatear la fecha
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: 'long',   // Día de la semana (ej. Lunes)
      day: 'numeric',    // Día del mes (ej. 1)
      month: 'long',     // Mes (ej. Octubre)
      year: 'numeric'    // Año (ej. 2024)
    };
  
    // Retorna la fecha formateada en español y en mayúsculas
    return fechaActual.toLocaleDateString('es-ES', opciones).toUpperCase();
  };
  
  


    // Función para seleccionar manualmente un producto
    const handleProductoClick = (producto: Producto) => {
        setProductoSeleccionado(producto);
    };

    return (
        <div className="outer-container">
            <div className="product-list-contenedor">
            <div className="entry-image" >
        <img 
          src="https://darsis.us/bioflex/wp-content/uploads/2023/05/logo_b.png"
          alt="Icono de Entrada" 
        />
      </div>

                {productos.map((producto, index) => (
                    <div 
                        key={index}
                        className="entry-producto"

                        onClick={() => handleProductoClick(producto)} // Selección manual
                    >
                        <p><strong>Área:</strong> <span>{producto.area}</span></p>
                        <p><strong>Clave de Producto:</strong> <span>{producto.claveProducto}</span></p>
                        <p><strong>Producto:</strong> <span>{producto.nombreProducto}</span></p>
                        <p><strong>Hora de Entrada:</strong> <span>{producto.horaEntrada}</span></p>
                    </div>
                ))}
            </div>

            <div className="container">
  {productoSeleccionado && (
    <>
     {/* Header de los Detalles del Producto */}
     <div className="header">
        <p className="nombre-almacen"><strong>ENTRADA PT-1</strong></p>
        <p className="fecha"><strong>{formatFecha()}</strong></p>
      </div>
      <div className='titulo-details'>
      <h1>DETALLES DEL PRODUCTO</h1>
      </div>

      <div className='main-content'>
      {/* Imagen del Producto */}
      <div className="product-image">
        <img src={productoSeleccionado.urlImagen} alt="Imagen del Producto" />
        {/* Estado del Producto */}
        <div className="status-checks">
          <p>
            <strong>Status:</strong> 
            <span className={statusOk ? "ok" : "error"}>
              {statusOk ? "✔️ OK" : "❌ Error"}
            </span>
          </p>
          <p>
            <strong>Registrado en SAP:</strong> 
            <span className={registroEntrada ? "ok" : "error"}>
              {registroEntrada ? "✔️ OK" : "❌ No registrado"}
            </span>
          </p>
        </div>
      </div>
      
      {/* Detalles del Producto */}
      <div className="product-details">
            <div className="detail-field">
                <label>PRODUCTO</label>
                <div className="input-with-icon">
                    <FontAwesomeIcon icon={faBox} />
                    <input type="text" value={productoSeleccionado.nombreProducto} readOnly />
                </div>
            </div>
            <div className="detail-field">
                <label>PESO NETO</label>
                <div className="input-with-icon">
                    <FontAwesomeIcon icon={faWeight} />
                    <input type="text" value={productoSeleccionado.pesoNeto} readOnly />
                </div>
            </div>
            <div className="detail-field">
                <label>PIEZAS</label>
                <div className="input-with-icon">
                    <FontAwesomeIcon icon={faCubes} />
                    <input type="text" value={productoSeleccionado.piezas} readOnly />
                </div>
            </div>
            <div className="detail-field">
                <label>UNIDAD DE MEDIDA</label>
                <div className="input-with-icon">
                    <FontAwesomeIcon icon={faRuler} />
                    <input type="text" value={productoSeleccionado.uom} readOnly />
                </div>
            </div>
            <div className="detail-field">
                <label>PRINTCARD</label>
                <div className="input-with-icon">
                    <FontAwesomeIcon icon={faTag} />
                    <input type="text" value={productoSeleccionado.productPrintCard} readOnly />
                </div>
            </div>
            <div className="detail-field">
                <label>OPERADOR</label>
                <div className="input-with-icon">
                    <FontAwesomeIcon icon={faTag} />
                    <input type="text" value={nombreOperador}  readOnly />
                </div>
            </div>
            </div>
      </div>
      
    </>
  )}
</div>

        </div>
        
    );
};


export default SalidaMP;
