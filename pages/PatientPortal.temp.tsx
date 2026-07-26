import React, { useMemo, useState, useEffect } from 'react';
import { User, Appointment, Specialty, AppointmentStatus, HealthUnit } from '../types';
import { api } from '../services/api';
import { STATUS_LABELS } from '../constants';
import { Calendar, Clock, User as UserIcon, CheckCircle, Search, Info, MapPin, Map as MapIcon, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Corrigir ícone padrão do Leaflet no React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export const PatientPortal: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [unitDoctors, setUnitDoctors] = useState<User[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);
  
  // Estado do fluxo de agendamento
  const [step, setStep] = useState(1);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [isDayFull, setIsDayFull] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('health_user');
    if (stored) {
      const u = JSON.parse(stored);
      setCurrentUser(u);
      loadMyAppointments(u);
      api.units.getById(u.unitId).then(setUnit);
    }
    api.specialties.getAll().then(specs => setSpecialties(specs));
  }, []);

  const loadMyAppointments = async (user: User) => {
      const [patients, doctorsByUnit] = await Promise.all([
        api.patients.getByUnit(user.unitId),
        api.users.getDoctorsByUnit(user.unitId)
      ]);
      setUnitDoctors(doctorsByUnit);
      const patient = patients.find(p => p.userId === user.id || p.email === user.email);
      if (patient) {
          const appts = await api.appointments.getByPatientId(patient.id);
          setMyAppointments(appts);
      }
  };

  const handleSpecSelect = async (specId: string) => {
      setSelectedSpec(specId);
      if (currentUser) {
          const allDocs = unitDoctors.length
            ? unitDoctors
            : await api.users.getDoctorsByUnit(currentUser.unitId);
          if (!unitDoctors.length) {
            setUnitDoctors(allDocs);
          }
          const docs = allDocs.filter(d => d.specialtyId === specId);
          setDoctors(docs);
          setStep(2);
      }
  };

  const handleDocSelect = (doc: User) => {
      setSelectedDoc(doc);
      setStep(3);
  };

  const handleDateSelect = async (date: string) => {
      setSelectedDate(date);
      setIsDayFull(false);
      setAvailableSlots([]);

      if (selectedDoc && selectedDoc.schedule && currentUser) {
          if (selectedDoc.maxDailyPatients) {
             const allAppts = await api.appointments.getByUnit(currentUser.unitId);
             const dailyCount = allAppts.filter(a => 
                 a.doctorId === selectedDoc.id && 
                 a.date === date && 
                 a.status !== AppointmentStatus.CANCELLED
             ).length;

             if (dailyCount >= selectedDoc.maxDailyPatients) {
                 setIsDayFull(true);
                 return;
             }
          }

          const day = new Date(date + 'T00:00:00').getDay();
          const schedule = selectedDoc.schedule.find(s => s.dayOfWeek === day);

          if (!schedule) {
              setAvailableSlots([]);
              return;
          }

          const slots: string[] = [];
          let current = convertToMinutes(schedule.startTime);
          const end = convertToMinutes(schedule.endTime);

          while (current < end) {
              const timeString = convertToString(current);
              slots.push(timeString);
              current += 30;
          }

          const existingAppts = (await api.appointments.getAll()).filter(a => a.doctorId === selectedDoc.id && a.date === date && a.status !== AppointmentStatus.CANCELLED);
          const bookedTimes = existingAppts.map(a => a.time);

          setAvailableSlots(slots.filter(s => !bookedTimes.includes(s)));
      }
  };

  const confirmAppointment = async () => {
      if (!currentUser || !selectedDoc || !selectedDate || !selectedTime) return;

      if (selectedDoc.maxDailyPatients) {
        const allAppts = await api.appointments.getByUnit(currentUser.unitId);
        const dailyCount = allAppts.filter(a => 
            a.doctorId === selectedDoc.id && 
            a.date === selectedDate && 
            a.status !== AppointmentStatus.CANCELLED
        ).length;

        if (dailyCount >= selectedDoc.maxDailyPatients) {
            alert('Desculpe, as vagas para este médico acabaram de ser preenchidas para esta data.');
            return;
        }
      }

      const patientsList = await api.patients.getByUnit(currentUser.unitId);
      let patient = patientsList.find(p => p.userId === currentUser.id || p.email === currentUser.email);
      
      if (!patient) {
          patient = await api.patients.add({
              name: currentUser.name,
              email: currentUser.email,
              phone: 'N/A',
              cpf: '000.000.000-00',
              birthDate: '2000-01-01',
              unitId: currentUser.unitId,
              userId: currentUser.id
          } as any);
      }

      await api.appointments.add({
          patientId: patient.id,
          doctorId: selectedDoc.id,
          unitId: currentUser.unitId, // RULE APPLIED: Only schedules on their linked USF
          date: selectedDate,
          time: selectedTime,
          notes: 'Agendado pelo Portal do Paciente'
      });

      alert('Consulta agendada com sucesso!');
      setStep(1);
      setSelectedSpec('');
      setSelectedDoc(null);
      setSelectedDate('');
      setSelectedTime('');
      loadMyAppointments(currentUser);
  };

  const convertToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
  };
  const convertToString = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getDocName = async (id: string) => {
      const users = await api.users.getAll();
      const u = users.find(u => u.id === id);
      return u ? u.name : 'Médico';
  };

  const doctorNameById = useMemo(() => {
      return new Map(unitDoctors.map(doctor => [doctor.id, doctor.name]));
  }, [unitDoctors]);

  const unitPosition: [number, number] = useMemo(() => {
      const latitude = Number.parseFloat((unit?.latitude || '').replace(',', '.'));
      const longitude = Number.parseFloat((unit?.longitude || '').replace(',', '.'));
      return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [latitude, longitude]
          : [-7.784, -34.896];
  }, [unit]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div>
          <h2 className="text-3xl font-black text-primary mb-2">Agendamento de Consulta</h2>
          <p className="text-slate-600 text-lg">Olá, <span className="font-bold">{currentUser?.name.split(' ')[0]}</span>. {step === 1 ? 'Selecione a especialidade para qual deseja agendar sua consulta.' : 'Siga os passos abaixo para agendar.'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Appointment Wizard */}
          <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                  {/* Step 1: Specialty */}
                  {step === 1 && (
                      <div className="animate-fade-in">
                          <div className="flex justify-between items-center mb-6">
                             <h3 className="text-xl font-bold text-slate-800">Especialidades disponíveis</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {specialties.map(spec => (
                                  <button 
                                    key={spec.id}
                                    onClick={() => handleSpecSelect(spec.id)}
                                    className="p-5 rounded-xl border border-slate-200 hover:border-primary hover:bg-blue-50 transition-all text-left bg-white text-slate-900 group flex justify-between items-center shadow-sm"
                                  >
                                      <span className="font-bold text-slate-700 group-hover:text-primary text-lg">{spec.name}</span>
                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                        →
                                      </div>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Step 2: Doctor */}
                  {step === 2 && (
                      <div className="animate-fade-in">
                          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Passo 2</p>
                                <h3 className="text-xl font-bold text-slate-800">Selecione o profissional</h3>
                            </div>
                            <button onClick={() => setStep(1)} className="text-sm font-bold text-primary hover:underline flex items-center gap-1">← Voltar</button>
                          </div>
                          
                          <div className="space-y-4">
                              {doctors.map(doc => (
                                  <button 
                                    key={doc.id}
                                    onClick={() => handleDocSelect(doc)}
                                    className="w-full p-4 rounded-xl border border-slate-200 hover:border-primary hover:bg-blue-50 transition-all flex items-center gap-4 bg-white text-slate-900 group"
                                  >
                                      <div className="w-14 h-14 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 overflow-hidden">
                                          <UserIcon className="w-7 h-7" />
                                      </div>
                                      <div className="text-left flex-1">
                                        <p className="font-bold text-lg text-slate-800 group-hover:text-primary">{doc.name}</p>
                                        <p className="text-sm text-slate-500">CRM: {doc.crm || 'Não informado'} • {specialties.find(s=>s.id === doc.specialtyId)?.name}</p>
                                      </div>
                                      <div className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-primary group-hover:bg-primary">
                                        <CheckCircle className="w-4 h-4 text-transparent group-hover:text-white" />
                                      </div>
                                  </button>
                              ))}
                              {doctors.length === 0 && (
                                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                     <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                     <p className="text-slate-500 font-medium">Nenhum profissional cadastrado ou disponível nesta especialidade na sua Unidade.</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {/* Step 3: Date & Time */}
                  {step === 3 && selectedDoc && (
                      <div className="animate-fade-in">
                          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Passo 3</p>
                                <h3 className="text-xl font-bold text-slate-800">Escolha a data e horário</h3>
                            </div>
                            <button onClick={() => setStep(2)} className="text-sm font-bold text-primary hover:underline flex items-center gap-1">← Voltar</button>
                          </div>

                          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
                              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200">
                                  <UserIcon className="w-6 h-6 text-slate-400" />
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800">{selectedDoc.name}</p>
                                  <p className="text-sm text-slate-500">Especialidade Selecionada</p>
                              </div>
                          </div>

                          <div className="space-y-6">
                              <div>
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Data da Consulta</label>
                                  <div className="relative">
                                      <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                                      <input 
                                          type="date"
                                          min={new Date().toISOString().split('T')[0]}
                                          className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white text-slate-900 font-medium"
                                          value={selectedDate}
                                          onChange={(e) => handleDateSelect(e.target.value)}
                                      />
                                  </div>
                              </div>

                              {selectedDate && (
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-2">Horários Disponíveis</label>
                                      
                                      {isDayFull ? (
                                          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 font-semibold text-center flex items-center justify-center gap-2">
                                              <Info className="w-5 h-5" /> Agenda lotada para este dia.
                                          </div>
                                      ) : availableSlots.length > 0 ? (
                                          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                              {availableSlots.map(slot => (
                                                  <button 
                                                    key={slot}
                                                    onClick={() => setSelectedTime(slot)}
                                                    className={`py-3 px-2 text-sm font-bold rounded-lg border transition-all ${
                                                        selectedTime === slot 
                                                        ? 'bg-primary text-white border-primary shadow-md' 
                                                        : 'bg-white text-slate-700 border-slate-300 hover:border-primary'
                                                    }`}
                                                  >
                                                      {slot}
                                                  </button>
                                              ))}
                                          </div>
                                      ) : (
                                          <div className="p-4 bg-orange-50 text-orange-600 rounded-lg text-sm border border-orange-100 font-semibold text-center flex items-center justify-center gap-2">
                                              <Info className="w-5 h-5" /> Não há horários nesta data.
                                          </div>
                                      )}
                                  </div>
                              )}

                              <button 
                                  disabled={!selectedTime || isDayFull}
                                  onClick={confirmAppointment}
                                  className="w-full bg-secondary hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex justify-center items-center gap-2 mt-4 text-lg"
                              >
                                  Confirmar Agendamento <CheckCircle className="w-5 h-5" />
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* My Appointments Side Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Seus Agendamentos</h3>
              
              <div className="space-y-4">
                  {myAppointments.length > 0 ? myAppointments.map(appt => (
                      <div key={appt.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                                  appt.status === AppointmentStatus.SCHEDULED ? 'bg-primary' : 
                                  appt.status === AppointmentStatus.COMPLETED ? 'bg-secondary' : 'bg-ita-red'
                          }`}></div>
                          
                          <div className="pl-3">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-slate-800 text-lg">{doctorNameById.get(appt.doctorId) ?? 'Médico'}</span>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                                      appt.status === AppointmentStatus.SCHEDULED ? 'bg-blue-50 text-primary' : 
                                      appt.status === AppointmentStatus.COMPLETED ? 'bg-green-50 text-secondary' : 'bg-red-50 text-ita-red'
                                  }`}>
                                      {STATUS_LABELS[appt.status]}
                                  </span>
                              </div>
                              <div className="flex flex-col gap-1.5 mt-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                      <Calendar className="w-4 h-4 text-primary" />
                                      {new Date(appt.date).toLocaleDateString()}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                      <Clock className="w-4 h-4 text-secondary" />
                                      {appt.time} <span className="text-slate-400 font-normal text-xs">(Ordem de chegada)</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                      <MapPin className="w-4 h-4 text-ita-red" />
                                      USF vinculada
                                  </div>
                              </div>
                          </div>
                      </div>
                  )) : (
                      <div className="text-center py-8">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Calendar className="w-8 h-8 text-slate-300" />
                          </div>
                          <p className="text-sm font-semibold text-slate-500">Nenhuma consulta agendada.</p>
                          <p className="text-xs text-slate-400 mt-1">Utilize o painel ao lado para agendar.</p>
                      </div>
                  )}
              </div>

              {unit && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <MapIcon className="w-5 h-5 text-primary" />
                          Sua USF: {unit.name}
                      </h4>
                      <div className="h-48 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner mb-4 relative z-0">
                          <MapContainer key={unit.id} center={unitPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                              <TileLayer
                                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <Marker position={unitPosition}>
                                  <Popup>
                                      <b>{unit.name}</b><br/>
                                      {unit.address}{unit.addressNumber ? `, ${unit.addressNumber}` : ''}<br/>
                                      {unit.neighborhood}, {unit.city}
                                  </Popup>
                              </Marker>
                          </MapContainer>
                      </div>
                      <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(unit.address + (unit.addressNumber ? ', ' + unit.addressNumber : '') + ', ' + unit.neighborhood + ', ' + unit.city + ', PE')}`}
                          target="_blank" 
                          rel="noreferrer" 
                          className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2"
                      >
                          <Navigation className="w-5 h-5" /> Como Chegar
                      </a>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
