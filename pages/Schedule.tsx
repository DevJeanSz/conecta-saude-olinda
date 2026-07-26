import React, { useState, useEffect } from "react";
import {
  User,
  UserRole,
  Appointment,
  Patient,
  AppointmentStatus,
  Specialty,
  HealthUnit,
} from "../types";
import { api } from "../services/api";
import { STATUS_LABELS } from "../constants";
import {
  Plus,
  X,
  Search,
  User as UserIcon,
  Calendar,
  Clock,
  Check,
  Sparkles,
  Loader2,
  Info,
} from "lucide-react";

interface ScheduleProps {
  user: User;
}

export const Schedule: React.FC<ScheduleProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Modals state
  const [showNewApptModal, setShowNewApptModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Appointment | null>(
    null,
  );

  // Form state
  const [newApptData, setNewApptData] = useState({
    patientId: "",
    doctorId: "",
    time: "09:00",
    notes: "",
  });

  // Doctor Action State
  const [doctorNotes, setDoctorNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [selectedDate, showNewApptModal, showDetailModal, user.unitId]);

  const loadData = async () => {
    try {
      const [unitAppts, patients, doctors, specialties, unitData] = await Promise.all([
        api.appointments.getByUnit(user.unitId),
        api.patients.getByUnit(user.unitId),
        api.users.getDoctorsByUnit(user.unitId),
        api.specialties.getAll(),
        api.units.getById(user.unitId),
      ]);

      const dayAppts = unitAppts.filter((a) => a.date === selectedDate);

      const sortedAppts = dayAppts.sort((a, b) => a.time.localeCompare(b.time));

      if (user.role === UserRole.DOCTOR) {
        setAppointments(sortedAppts.filter((a) => a.doctorId === user.id));
      } else {
        setAppointments(sortedAppts);
      }

      setPatients(patients);
      setDoctors(doctors);
      setSpecialties(specialties);
      setUnit(unitData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setAppointments([]);
      setPatients([]);
      setDoctors([]);
      setSpecialties([]);
      setUnit(null);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApptData.patientId || !newApptData.doctorId) return;

    // 1. Specialty Limits and Rules Check
    const selectedDoctor = doctors.find((d) => d.id === newApptData.doctorId);
    const selectedSpecialty = selectedDoctor?.specialtyId ? specialties.find(s => s.id === selectedDoctor.specialtyId) : null;
    const allAppts = await api.appointments.getByUnit(user.unitId);

    if (selectedSpecialty) {
      // Check Days of Week
      if (selectedSpecialty.schedule && selectedSpecialty.schedule.length > 0) {
          const [year, month, day] = selectedDate.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);
          const dayOfWeek = dateObj.getDay(); // 0 = Sunday
          const isAttendedDay = selectedSpecialty.schedule.some(s => s.dayOfWeek === dayOfWeek);

          if (!isAttendedDay) {
              alert(`A especialidade ${selectedSpecialty.name} não atende neste dia da semana.`);
              return;
          }
      }

      // Check Specialty Limits
      if (selectedSpecialty.maxDailyAppointments) {
          const specialtyDoctorIds = doctors.filter(d => d.specialtyId === selectedSpecialty.id).map(d => d.id);
          const specialtyDailyCount = allAppts.filter(
              (a) =>
                  specialtyDoctorIds.includes(a.doctorId) &&
                  a.date === selectedDate &&
                  a.status !== AppointmentStatus.CANCELLED
          ).length;

          if (specialtyDailyCount >= selectedSpecialty.maxDailyAppointments) {
              alert(`LIMITE DA ESPECIALIDADE ATINGIDO: A cota diária de ${selectedSpecialty.maxDailyAppointments} atendimentos para ${selectedSpecialty.name} foi atingida.`);
              return;
          }
      }
    }

    // 2. Check for Max Daily Patients Logic (Doctor specific)
    if (selectedDoctor && selectedDoctor.maxDailyPatients) {

      const dailyCount = allAppts.filter(
        (a) =>
          a.doctorId === newApptData.doctorId &&
          a.date === selectedDate &&
          a.status !== AppointmentStatus.CANCELLED,
      ).length;

      if (dailyCount >= selectedDoctor.maxDailyPatients) {
        alert(
          `LIMITE DIÁRIO ATINGIDO: O Dr(a). ${selectedDoctor.name} já atingiu o limite de ${selectedDoctor.maxDailyPatients} atendimentos para esta data.`,
        );
        return;
      }
    }

    // 3. Check for double booking
    const conflict = allAppts.find(
      (a) =>
        a.doctorId === newApptData.doctorId &&
        a.date === selectedDate &&
        a.time === newApptData.time &&
        a.status !== AppointmentStatus.CANCELLED,
    );

    if (conflict) {
      alert("Este médico já possui um agendamento neste horário!");
      return;
    }

    // 4. Create appointment
    await api.appointments.add({
      ...newApptData,
      date: selectedDate,
      unitId: user.unitId,
    });

    // 5. Notify doctor
    if (user.id !== newApptData.doctorId) {
      const patientName =
        patients.find((p) => p.id === newApptData.patientId)?.name ??
        "Paciente";

      const dateFormatted = new Date(selectedDate).toLocaleDateString("pt-BR");

      await api.notifications.add(
        newApptData.doctorId,
        `Nova consulta agendada: ${patientName} em ${dateFormatted} às ${newApptData.time}`,
      );
    }

    setShowNewApptModal(false);
    setNewApptData({
      patientId: "",
      doctorId: "",
      time: "09:00",
      notes: "",
    });
  };

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    api.appointments.update(id, { status });
    loadData();
    if (showDetailModal && showDetailModal.id === id) {
      setShowDetailModal({ ...showDetailModal, status });
    }
  };

  const handleSaveNotes = () => {
    if (showDetailModal) {
      api.appointments.update(showDetailModal.id, {
        notes: doctorNotes,
      });
      setShowDetailModal(null);
      setDoctorNotes("");
    }
  };

  const getPatientName = (id: string) =>
    patients.find((p) => p.id === id)?.name || "Desconhecido";
  const getDoctorName = (id: string) =>
    doctors.find((d) => d.id === id)?.name || "Desconhecido";
  const getSpecialtyName = (id?: string) =>
    specialties.find((s) => s.id === id)?.name || "";

  const statusColors = {
    [AppointmentStatus.SCHEDULED]: "bg-blue-100 text-blue-700",
    [AppointmentStatus.COMPLETED]: "bg-green-100 text-green-700",
    [AppointmentStatus.CANCELLED]: "bg-red-100 text-red-700",
    [AppointmentStatus.NO_SHOW]: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Agenda de Consultas
          </h2>
          <p className="text-slate-500">Gerencie os atendimentos do dia</p>
        </div>

        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 shadow-sm"
          />
          {user.role !== UserRole.DOCTOR && (
            <button
              onClick={() => setShowNewApptModal(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agendar
            </button>
          )}
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-600 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange-800">
            Atenção: {unit?.attendanceType === 'SENHA' ? 'Atendimento por Senha' : 'Ordem de Chegada'}
          </p>
          <p className="text-sm text-orange-700">
            {unit?.attendanceType === 'SENHA' 
              ? 'Apesar do horário agendado, o atendimento no PSF segue estritamente a ordem das senhas emitidas na unidade. O horário serve apenas como previsão.' 
              : 'Apesar do horário agendado, o atendimento no PSF segue estritamente a ordem de chegada dos pacientes na unidade. O horário serve apenas como previsão.'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {appointments.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Nenhuma consulta agendada para esta data nesta unidade.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-medium text-slate-500">
                    Horário Previsto
                  </th>
                  <th className="p-4 font-medium text-slate-500">Paciente</th>
                  {user.role !== UserRole.DOCTOR && (
                    <th className="p-4 font-medium text-slate-500">Médico</th>
                  )}
                  <th className="p-4 font-medium text-slate-500">Status</th>
                  <th className="p-4 font-medium text-slate-500 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appt) => (
                  <tr
                    key={appt.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-4 font-semibold text-slate-700">
                      {appt.time}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-slate-900">
                          {getPatientName(appt.patientId)}
                        </span>
                      </div>
                    </td>
                    {user.role !== UserRole.DOCTOR && (
                      <td className="p-4 text-slate-600">
                        {getDoctorName(appt.doctorId)}
                      </td>
                    )}
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[appt.status]}`}
                      >
                        {STATUS_LABELS[appt.status]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setDoctorNotes(appt.notes || "");
                          setShowDetailModal(appt);
                        }}
                        className="text-primary hover:text-primary-dark font-medium text-sm"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Appointment Modal */}
      {showNewApptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                Novo Agendamento
              </h3>
              <button
                onClick={() => setShowNewApptModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Paciente
                  </label>
                  <select
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    value={newApptData.patientId}
                    onChange={(e) =>
                      setNewApptData({
                        ...newApptData,
                        patientId: e.target.value,
                      })
                    }
                  >
                    <option value="">Selecione...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Horário Previsto
                  </label>
                  <input
                    type="time"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    value={newApptData.time}
                    onChange={(e) =>
                      setNewApptData({ ...newApptData, time: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Médico
                </label>
                <select
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                  value={newApptData.doctorId}
                  onChange={(e) =>
                    setNewApptData({ ...newApptData, doctorId: e.target.value })
                  }
                >
                  <option value="">Selecione...</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} - {getSpecialtyName(d.specialtyId)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observação Inicial
                </label>
                <textarea
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                  rows={2}
                  value={newApptData.notes}
                  onChange={(e) =>
                    setNewApptData({ ...newApptData, notes: e.target.value })
                  }
                ></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewApptModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Detail / Doctor Action Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Detalhes da Consulta
                </h3>
                <p className="text-sm text-slate-500">
                  {getPatientName(showDetailModal.patientId)} -{" "}
                  {showDetailModal.time}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Actions for Status */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-slate-700 self-center mr-2">
                  Status:
                </span>
                {Object.values(AppointmentStatus).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(showDetailModal.id, s)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      showDetailModal.status === s
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {/* Clinical Notes (Editable by Doctor) */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Notas Clínicas
                </label>
                <textarea
                  disabled={user.role !== UserRole.DOCTOR}
                  className="w-full p-4 border border-slate-300 rounded-lg h-32 focus:ring-2 focus:ring-primary outline-none resize-none bg-white text-slate-900"
                  placeholder="Descreva sintomas, diagnóstico e prescrições..."
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-sm"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
